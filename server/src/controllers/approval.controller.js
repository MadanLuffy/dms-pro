import { prisma } from '../lib/prisma.js';
import { createAuditLog } from '../utils/audit.js';
import { emitToUser } from '../sockets/index.js';
import { emitToFileParticipants } from '../utils/fileAudience.js';
import { FILE_STATUS, APPROVAL_STATUS, GATE, ACTIONS } from '../constants.js';
import { fileInclude } from '../utils/fileView.js';
import { httpError } from '../utils/httpError.js';
import { txOptions } from '../utils/query.js';

async function runDecision(tx, req, approvalId, decision, comments) {
  const approval = await tx.approvalMatrix.findUnique({
    where: { id: approvalId },
    include: {
      file: { include: { targetDepts: true } },
      department: true,
    },
  });
  if (!approval) throw httpError(404, 'Approval entry not found');
  if (approval.status !== APPROVAL_STATUS.PENDING) {
    throw httpError(409, 'This approval has already been decided');
  }

  if (approval.gate === GATE.DEPT) {
    if (req.user.role !== 'DEPT_HEAD' || req.user.deptId !== approval.deptId) {
      throw httpError(403, 'Only the department head can decide this');
    }
  } else if (approval.gate === GATE.CEO) {
    if (req.user.role !== 'CEO') {
      throw httpError(403, 'Only the CEO can decide this');
    }
    const pendingDeptGates = await tx.approvalMatrix.count({
      where: { fileId: approval.fileId, gate: GATE.DEPT, status: APPROVAL_STATUS.PENDING },
    });
    if (pendingDeptGates > 0) {
      throw httpError(409, 'All department approvals are required before CEO sign-off');
    }
  }

  if (decision === 'return') {
    await tx.approvalMatrix.update({
      where: { id: approval.id },
      data: {
        status: APPROVAL_STATUS.RETURNED,
        reviewedBy: req.user.id,
        comments,
        timestamp: new Date(),
      },
    });
    await tx.subjectFile.update({
      where: { id: approval.fileId },
      data: { status: FILE_STATUS.RETURNED },
    });
    return { kind: 'return', approval };
  }

  await tx.approvalMatrix.update({
    where: { id: approval.id },
    data: {
      status: APPROVAL_STATUS.APPROVED,
      reviewedBy: req.user.id,
      comments,
      timestamp: new Date(),
    },
  });

  const remaining = await tx.approvalMatrix.count({
    where: { fileId: approval.fileId, status: APPROVAL_STATUS.PENDING },
  });
  const isCeoGate = approval.gate === GATE.CEO;

  let newStatus = FILE_STATUS.DEPT_HEAD_REVIEW;
  if (isCeoGate) newStatus = FILE_STATUS.APPROVED;
  else if (remaining === 1) {
    const ceoGate = await tx.approvalMatrix.findFirst({
      where: { fileId: approval.fileId, gate: GATE.CEO },
    });
    if (ceoGate && ceoGate.id !== approval.id) newStatus = FILE_STATUS.CEO_REVIEW;
  }

  const file = await tx.subjectFile.update({
    where: { id: approval.fileId },
    data: { status: newStatus },
    include: fileInclude,
  });

  return { kind: 'approve', approval, file, newStatus, isCeoGate };
}

export async function decideApproval(req, res, next) {
  try {
    const { decision, comments = '', approvalId } = req.body || {};
    if (!['approve', 'return'].includes(decision)) {
      return res.status(400).json({ error: 'decision must be "approve" or "return"' });
    }
    if (!approvalId) return res.status(400).json({ error: 'approvalId is required' });

    const work = (tx) => runDecision(tx, req, approvalId, decision, comments);
    const txOpts = txOptions();
    const result = txOpts ? await prisma.$transaction(work, txOpts) : await prisma.$transaction(work);

    if (result.kind === 'return') {
      await createAuditLog({
        userId: req.user.id,
        userName: req.user.name,
        action: ACTIONS.FILE_RETURNED,
        details: { refNo: result.approval.file.refNo, gate: result.approval.gate, comments },
        ipAddress: req.ipAddress,
      });
      const payload = { fileId: result.approval.fileId, refNo: result.approval.file.refNo, comments };
      await emitToFileParticipants(result.approval.file, 'file:returned', payload);
      await emitToFileParticipants(result.approval.file, 'approval:returned', {
        fileId: result.approval.fileId,
        refNo: result.approval.file.refNo,
      });
      return res.json({ file: { id: result.approval.fileId, status: FILE_STATUS.RETURNED }, ok: true });
    }

    const { file, newStatus, isCeoGate, approval } = result;
    const logAction = isCeoGate ? ACTIONS.CEO_APPROVED : ACTIONS.DEPT_APPROVED;
    await createAuditLog({
      userId: req.user.id,
      userName: req.user.name,
      action: logAction,
      details: { refNo: file.refNo, gate: approval.gate, dept: approval.department?.name },
      ipAddress: req.ipAddress,
    });

    await emitToFileParticipants(file, 'approval:granted', {
      fileId: file.id,
      refNo: file.refNo,
      gate: isCeoGate ? 'CEO' : 'DEPT',
      status: newStatus,
    });

    if (isCeoGate) {
      await emitToFileParticipants(file, 'file:approved', { fileId: file.id, refNo: file.refNo });
    } else if (newStatus === FILE_STATUS.CEO_REVIEW) {
      const ceos = await prisma.user.findMany({ where: { role: 'CEO' } });
      for (const ceo of ceos) {
        emitToUser(ceo.id, 'approval:ready', { fileId: file.id, refNo: file.refNo });
      }
    }

    res.json({ file: { id: file.id, status: newStatus } });
  } catch (err) {
    next(err);
  }
}

import { webcrypto } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { createAuditLog } from '../utils/audit.js';
import { emitToUser } from '../sockets/index.js';
import { emitToFileAudience, emitToFileParticipants } from '../utils/fileAudience.js';
import { contains, parsePagination } from '../utils/query.js';
import { unlinkUploadByUrl } from '../utils/diskFile.js';
import { parseIdList } from '../utils/confirmDepts.js';
import {
  FILE_STATUS,
  APPROVAL_STATUS,
  GATE,
  PRIORITY,
  SECRECY,
  ACTIONS,
} from '../constants.js';
import {
  fileInclude,
  listFileInclude,
  toPublicFile,
  toPublicListFile,
  canAccessFile,
} from '../utils/fileView.js';

function generateRefNo() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  const arr = new Uint32Array(6);
  webcrypto.getRandomValues(arr);
  for (let i = 0; i < 6; i++) rand += chars[arr[i] % chars.length];
  return `DMS-${rand}`;
}

export async function listFiles(req, res, next) {
  try {
    const { status, department, q } = req.query || {};
    const { page, pageSize, skip, take } = parsePagination(req.query);
    const where = {};
    if (status && status !== 'ALL') where.status = status;
    if (department && department !== 'ALL') {
      where.targetDepts = { some: { deptId: department } };
    }
    const search = q
      ? {
          OR: [
            { subject: contains(q) },
            { refNo: contains(q) },
            { creator: { name: contains(q) } },
          ],
        }
      : null;

    if (req.user.role === 'STAFF') {
      const scope = [{ creatorId: req.user.id }, { assignedOfficerId: req.user.id }];
      if (search) {
        where.AND = [search, { OR: scope }];
      } else {
        where.OR = scope;
      }
    } else if (req.user.role === 'DEPT_HEAD') {
      const scope = [
        { creatorId: req.user.id },
        { targetDepts: { some: { deptId: req.user.deptId } } },
      ];
      if (search) {
        where.AND = [search, { OR: scope }];
      } else {
        where.OR = scope;
      }
    } else if (req.user.role === 'SUPERADMIN') {
      return res.json({ files: [], total: 0, page, pageSize });
    } else if (search) {
      where.OR = search.OR;
    }

    const [total, files] = await Promise.all([
      prisma.subjectFile.count({ where }),
      prisma.subjectFile.findMany({
        where,
        include: listFileInclude,
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
      }),
    ]);

    res.json({ files: files.map(toPublicListFile), total, page, pageSize });
  } catch (err) {
    next(err);
  }
}

export async function getFile(req, res, next) {
  try {
    const file = await prisma.subjectFile.findUnique({
      where: { id: req.params.id },
      include: fileInclude,
    });
    if (!file) return res.status(404).json({ error: 'File not found' });
    if (!canAccessFile(req.user, file)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json({ file: toPublicFile(file) });
  } catch (err) {
    next(err);
  }
}

export async function createFile(req, res, next) {
  try {
    if (req.user.role === 'SUPERADMIN') {
      return res.status(403).json({ error: 'Administrators manage users and departments, not file workflows' });
    }
    const { subject, priority: rawPriority = 'NORMAL', secrecy: rawSecrecy = 'INTERNAL', initialNote = '', assignedOfficerId: rawOfficerId = null, targetDeptIds } = req.body || {};
    let assignedOfficerId = rawOfficerId;
    if (assignedOfficerId === 'null' || assignedOfficerId === 'undefined' || assignedOfficerId === '') {
      assignedOfficerId = null;
    }
    const deptIds = parseIdList(targetDeptIds);
    if (!subject || typeof subject !== 'string') {
      return res.status(400).json({ error: 'Subject is required' });
    }
    const priority = PRIORITY.includes(rawPriority) ? rawPriority : 'NORMAL';
    const secrecy = SECRECY.includes(rawSecrecy) ? rawSecrecy : 'INTERNAL';

    if (deptIds.length) {
      const depts = await prisma.department.findMany({ where: { id: { in: deptIds } } });
      if (depts.length !== new Set(deptIds).size) {
        return res.status(400).json({ error: 'Invalid target department' });
      }
    }

    if (assignedOfficerId) {
      const officer = await prisma.user.findUnique({ where: { id: assignedOfficerId } });
      if (!officer) return res.status(400).json({ error: 'Invalid officer' });
      if (officer.role === 'SUPERADMIN') return res.status(400).json({ error: 'Administrators cannot be assigned as file officers' });
    }

    const departments = deptIds.length ? await prisma.department.findMany() : [];
    const isCeoOnly = Boolean(deptIds.length && departments.length && deptIds.length >= Math.max(departments.length - 1, 1));

    let refNo;
    for (let i = 0; i < 5; i++) {
      const candidate = generateRefNo();
      const existing = await prisma.subjectFile.findUnique({ where: { refNo: candidate } });
      if (!existing) {
        refNo = candidate;
        break;
      }
    }
    if (!refNo) return res.status(500).json({ error: 'Could not allocate a reference number' });

    const file = await prisma.subjectFile.create({
      data: {
        refNo,
        subject,
        priority,
        secrecy,
        status: FILE_STATUS.DEPT_HEAD_REVIEW,
        creatorId: req.user.id,
        assignedOfficerId,
        ...(deptIds.length
          ? {
              targetDepts: { create: deptIds.map((deptId) => ({ deptId })) },
              approvalMatrix: {
                create: [
                  ...deptIds.map((deptId, idx) => ({
                    deptId,
                    gate: GATE.DEPT,
                    status: APPROVAL_STATUS.PENDING,
                    comments: idx === 0 ? 'New file awaiting department approval' : null,
                  })),
                  {
                    deptId: isCeoOnly ? departments[0].id : deptIds[0],
                    gate: GATE.CEO,
                    status: APPROVAL_STATUS.PENDING,
                  },
                ],
              },
            }
          : {}),
        notes: initialNote.trim() || (req.files && req.files.length > 0)
          ? {
              create: {
                version: 1,
                order: 1,
                content: initialNote,
                sentTo: deptIds.join(', ') || '',
                authorId: req.user.id,
              },
            }
          : undefined,
      },
      include: fileInclude,
    });

    const initialNoteRecord = file.notes?.find((n) => n.order === 1);
    if (req.files && req.files.length > 0 && initialNoteRecord) {
      await prisma.attachment.createMany({
        data: req.files.map((f) => ({
          fileId: file.id,
          noteId: initialNoteRecord.id,
          filename: f.originalname,
          fileUrl: `/uploads/${f.filename}`,
          mimeType: f.mimetype,
          sizeBytes: f.size,
        })),
      });
      await emitToFileParticipants(file, 'note:added', {
        fileId: file.id,
        refNo: file.refNo,
        noteId: initialNoteRecord.id,
        version: initialNoteRecord.version,
        author: req.user.name,
      });
    }

    await createAuditLog({
      userId: req.user.id,
      userName: req.user.name,
      action: ACTIONS.FILE_CREATED,
      details: { refNo: file.refNo, subject: file.subject, targetDepts: deptIds },
      ipAddress: req.ipAddress,
    });

    await emitToFileAudience(file, 'file:created', {
      fileId: file.id,
      refNo: file.refNo,
      subject: file.subject,
    });
    for (const deptId of deptIds) {
      const heads = await prisma.user.findMany({ where: { deptId, role: 'DEPT_HEAD' } });
      for (const u of heads) {
        if (u.id === req.user.id) continue;
        emitToUser(u.id, 'file:forwarded', {
          fileId: file.id,
          refNo: file.refNo,
          subject: file.subject,
        });
      }
    }
    if (assignedOfficerId && assignedOfficerId !== req.user.id) {
      emitToUser(assignedOfficerId, 'file:forwarded', {
        fileId: file.id,
        refNo: file.refNo,
        subject: file.subject,
      });
    }

    res.status(201).json({ file: toPublicFile(file) });
  } catch (err) {
    next(err);
  }
}

export async function updateFile(req, res, next) {
  try {
    const { assignedOfficerId, secrecy, resubmit } = req.body || {};
    const existing = await prisma.subjectFile.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'File not found' });
    if (req.user.role === 'SUPERADMIN' || existing.creatorId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: only the file creator can update this file' });
    }

    const data = {};
    if (resubmit && existing.status === FILE_STATUS.RETURNED) {
      const returnedGate = await prisma.approvalMatrix.findFirst({
        where: { fileId: existing.id, status: APPROVAL_STATUS.RETURNED },
      });
      if (!returnedGate) return res.status(400).json({ error: 'No returned approval found to resubmit' });
      await prisma.approvalMatrix.update({ where: { id: returnedGate.id }, data: { status: APPROVAL_STATUS.PENDING, reviewedBy: null, comments: null, timestamp: null } });
      data.status = returnedGate.gate === GATE.CEO ? FILE_STATUS.CEO_REVIEW : FILE_STATUS.DEPT_HEAD_REVIEW;
      await createAuditLog({
        userId: req.user.id,
        userName: req.user.name,
        action: 'FILE_RESUBMITTED',
        details: { refNo: existing.refNo },
        ipAddress: req.ipAddress,
      });
    }
    if (secrecy && SECRECY.includes(secrecy)) data.secrecy = secrecy;
    if (assignedOfficerId !== undefined) {
      const officer = await prisma.user.findUnique({ where: { id: assignedOfficerId } });
      if (assignedOfficerId && !officer) return res.status(400).json({ error: 'Invalid officer' });
      if (assignedOfficerId && officer.role === 'SUPERADMIN') {
        return res.status(400).json({ error: 'Administrators cannot be assigned as file officers' });
      }
      data.assignedOfficerId = assignedOfficerId || null;
    }

    if (Object.keys(data).length === 0) return res.status(400).json({ error: 'Nothing to update' });
    const file = await prisma.subjectFile.update({
      where: { id: existing.id },
      data,
      include: fileInclude,
    });
    res.json({ file: toPublicFile(file) });
  } catch (err) {
    next(err);
  }
}

export async function deleteFile(req, res, next) {
  try {
    const existing = await prisma.subjectFile.findUnique({
      where: { id: req.params.id },
      include: { targetDepts: true },
    });
    if (!existing) return res.status(404).json({ error: 'File not found' });
    if (req.user.role === 'SUPERADMIN' || existing.creatorId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: only the file creator can delete this file' });
    }

    const attachments = await prisma.attachment.findMany({ where: { fileId: existing.id } });

    await prisma.$transaction([
      prisma.attachment.deleteMany({ where: { fileId: existing.id } }),
      prisma.note.deleteMany({ where: { fileId: existing.id } }),
      prisma.subjectFileDept.deleteMany({ where: { fileId: existing.id } }),
      prisma.approvalMatrix.deleteMany({ where: { fileId: existing.id } }),
      prisma.subjectFile.delete({ where: { id: existing.id } }),
    ]);

    for (const att of attachments) {
      unlinkUploadByUrl(att.fileUrl);
    }

    await createAuditLog({
      userId: req.user.id,
      userName: req.user.name,
      action: 'FILE_DELETED',
      details: { refNo: existing.refNo },
      ipAddress: req.ipAddress,
    });
    await emitToFileAudience(existing, 'file:deleted', { fileId: existing.id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
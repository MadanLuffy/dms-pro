import { APPROVAL_STATUS, GATE, FILE_STATUS } from '../constants.js';
import { httpError } from './httpError.js';

export function parseIdList(raw) {
  let ids = raw;
  if (typeof ids === 'string') {
    const trimmed = ids.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        ids = JSON.parse(trimmed);
      } catch {
        ids = trimmed.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean);
      }
    } else {
      ids = trimmed.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  if (!Array.isArray(ids)) ids = ids ? [ids] : [];
  return [...new Set(ids.filter(Boolean))];
}

export async function ensureConfirmationDepts(db, { fileId, deptIds, currentStatus }) {
  const uniqueIds = [...new Set((deptIds || []).filter(Boolean))];
  if (!uniqueIds.length) return { addedDeptIds: [], status: currentStatus };

  const depts = await db.department.findMany({ where: { id: { in: uniqueIds } } });
  if (depts.length !== uniqueIds.length) {
    throw httpError(400, 'Invalid department for confirmation');
  }

  const addedDeptIds = [];
  for (const deptId of uniqueIds) {
    await db.subjectFileDept.upsert({
      where: { fileId_deptId: { fileId, deptId } },
      update: {},
      create: { fileId, deptId },
    });
    const existingGate = await db.approvalMatrix.findFirst({
      where: { fileId, deptId, gate: GATE.DEPT },
    });
    if (!existingGate) {
      await db.approvalMatrix.create({
        data: {
          fileId,
          deptId,
          gate: GATE.DEPT,
          status: APPROVAL_STATUS.PENDING,
        },
      });
      addedDeptIds.push(deptId);
    }
  }

  const ceoGate = await db.approvalMatrix.findFirst({
    where: { fileId, gate: GATE.CEO },
  });
  if (!ceoGate) {
    await db.approvalMatrix.create({
      data: {
        fileId,
        deptId: uniqueIds[0],
        gate: GATE.CEO,
        status: APPROVAL_STATUS.PENDING,
      },
    });
  }

  let status = currentStatus;
  if (status !== FILE_STATUS.APPROVED && status !== FILE_STATUS.CEO_REVIEW && status !== FILE_STATUS.RETURNED) {
    status = FILE_STATUS.DEPT_HEAD_REVIEW;
    if (status !== currentStatus) {
      await db.subjectFile.update({ where: { id: fileId }, data: { status } });
    }
  }

  return { addedDeptIds, status, departments: depts };
}

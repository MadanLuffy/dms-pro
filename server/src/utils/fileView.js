export const fileInclude = {
  creator: { include: { department: true } },
  assignedOfficer: { include: { department: true } },
  targetDepts: { include: { department: true } },
  approvalMatrix: { include: { department: true, reviewer: true } },
  notes: {
    include: {
      author: true,
      attachments: true,
    },
    orderBy: { createdAt: 'asc' },
  },
  attachments: { orderBy: { uploadedAt: 'asc' } },
};

export const listFileInclude = {
  creator: { include: { department: true } },
  assignedOfficer: { include: { department: true } },
  targetDepts: { include: { department: true } },
};

export const fileAccessSelect = {
  id: true,
  refNo: true,
  subject: true,
  creatorId: true,
  assignedOfficerId: true,
  targetDepts: { select: { deptId: true } },
};

function mapAttachment(att) {
  return {
    id: att.id,
    filename: att.filename,
    fileUrl: att.fileUrl,
    mimeType: att.mimeType,
    sizeBytes: att.sizeBytes,
  };
}

function toPublicNote(n) {
  return {
    id: n.id,
    parentId: n.parentId || null,
    version: n.version,
    content: n.content,
    sentTo: n.sentTo,
    createdAt: n.createdAt,
    author: { id: n.author?.id, name: n.author?.name, role: n.author?.role },
    attachments: (n.attachments || []).map(mapAttachment),
    replies: [],
  };
}

function nestNotes(notes = []) {
  const nodes = notes.map(toPublicNote);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const roots = [];
  for (const node of nodes) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId).replies.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export function toPublicFile(file) {
  if (!file) return null;
  return {
    id: file.id,
    refNo: file.refNo,
    subject: file.subject,
    priority: file.priority,
    secrecy: file.secrecy,
    status: file.status,
    creator: {
      id: file.creator?.id,
      name: file.creator?.name,
      email: file.creator?.email,
      departmentName: file.creator?.department?.name,
    },
    assignedOfficer: file.assignedOfficer
      ? {
          id: file.assignedOfficer.id,
          name: file.assignedOfficer.name,
          departmentName: file.assignedOfficer.department?.name,
        }
      : null,
    targetDepts: file.targetDepts.map((t) => ({ id: t.department.id, name: t.department.name })),
    approvalMatrix: file.approvalMatrix.map((a) => ({
      id: a.id,
      deptId: a.deptId,
      gate: a.gate,
      status: a.status,
      departmentName: a.department?.name,
      reviewedBy: a.reviewer?.name || null,
      comments: a.comments,
      timestamp: a.timestamp,
    })),
    notes: nestNotes(file.notes),
    attachments: file.attachments.map(mapAttachment),
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
  };
}

export function toPublicListFile(file) {
  return {
    id: file.id,
    refNo: file.refNo,
    subject: file.subject,
    priority: file.priority,
    secrecy: file.secrecy,
    status: file.status,
    creator: {
      id: file.creator?.id,
      name: file.creator?.name,
      departmentName: file.creator?.department?.name,
    },
    assignedOfficer: file.assignedOfficer
      ? {
          id: file.assignedOfficer.id,
          name: file.assignedOfficer.name,
          departmentName: file.assignedOfficer.department?.name,
        }
      : null,
    targetDepts: file.targetDepts.map((t) => ({ id: t.department.id, name: t.department.name })),
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
  };
}

export function canAccessFile(user, file) {
  if (!user || !file) return false;
  if (user.role === 'CEO') return true;
  if (file.creatorId && user.id === file.creatorId) return true;
  if (file.assignedOfficerId && user.id === file.assignedOfficerId) return true;
  if (user.role === 'DEPT_HEAD' && Array.isArray(file.targetDepts)) {
    return file.targetDepts.some((t) => t.deptId === user.deptId);
  }
  return false;
}
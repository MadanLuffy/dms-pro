import { prisma } from '../lib/prisma.js';
import { emitToUser } from '../sockets/index.js';

export function deptIdsFromFile(file) {
  return [
    ...new Set(
      (file?.targetDepts || [])
        .map((t) => t.deptId || t.department?.id)
        .filter(Boolean)
    ),
  ];
}

export async function getFileAudienceUserIds(file) {
  const ids = new Set();
  if (file?.creatorId) ids.add(file.creatorId);
  if (file?.assignedOfficerId) ids.add(file.assignedOfficerId);

  const deptIds = deptIdsFromFile(file);
  const extra = await prisma.user.findMany({
    where: {
      OR: [
        ...(deptIds.length ? [{ role: 'DEPT_HEAD', deptId: { in: deptIds } }] : []),
        { role: 'CEO' },
      ],
    },
    select: { id: true },
  });
  for (const user of extra) ids.add(user.id);
  return [...ids];
}

export async function getFileParticipantUserIds(file) {
  const ids = new Set(await getFileAudienceUserIds(file));
  if (file?.id) {
    const authors = await prisma.note.findMany({
      where: { fileId: file.id },
      select: { authorId: true },
    });
    for (const row of authors) ids.add(row.authorId);
  }
  return [...ids];
}

export async function emitToUserIds(userIds, event, payload) {
  for (const id of new Set((userIds || []).filter(Boolean))) {
    emitToUser(id, event, payload);
  }
}

export async function emitToFileAudience(file, event, payload) {
  await emitToUserIds(await getFileAudienceUserIds(file), event, payload);
}

export async function emitToFileParticipants(file, event, payload) {
  await emitToUserIds(await getFileParticipantUserIds(file), event, payload);
}

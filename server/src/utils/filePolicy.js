import { FILE_STATUS, ROLES } from '../constants.js';

export function canDeleteSubjectFile(user, file) {
  if (!user || !file) return false;
  if (user.role === ROLES.SUPERADMIN) return false;
  const creatorId = file.creatorId || file.creator?.id;
  if (!creatorId || user.id !== creatorId) return false;
  if (file.status === FILE_STATUS.APPROVED) return false;
  return true;
}

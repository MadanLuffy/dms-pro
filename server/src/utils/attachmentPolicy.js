import { APPROVAL_STATUS, FILE_STATUS } from '../constants.js';

export function areAttachmentsLocked(file) {
  if (!file) return true;
  if (file.status === FILE_STATUS.RETURNED) return false;
  if (file.status === FILE_STATUS.APPROVED || file.status === FILE_STATUS.CEO_REVIEW) return true;
  return (file.approvalMatrix || []).some((row) => row.status === APPROVAL_STATUS.APPROVED);
}

export function canDeleteAttachment(user, file, attachment) {
  if (!user || !file || !attachment) return false;
  if (areAttachmentsLocked(file)) return false;
  if (file.creatorId && user.id === file.creatorId) return true;
  if (file.creator?.id && user.id === file.creator.id) return true;
  const noteAuthorId = attachment.noteAuthorId || attachment.note?.authorId || attachment.authorId;
  if (noteAuthorId && user.id === noteAuthorId) return true;
  return false;
}

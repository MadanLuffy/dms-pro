export function areAttachmentsLocked(file) {
  if (!file) return true;
  if (file.status === 'RETURNED') return false;
  if (file.status === 'APPROVED' || file.status === 'CEO_REVIEW') return true;
  return (file.approvalMatrix || []).some((row) => row.status === 'APPROVED');
}

export function canDeleteAttachment(user, file, attachment, noteAuthorId) {
  if (!user || !file || !attachment) return false;
  if (areAttachmentsLocked(file)) return false;
  if (user.id === file.creator?.id) return true;
  const authorId = noteAuthorId || attachment.noteAuthorId;
  if (authorId && user.id === authorId) return true;
  return false;
}

export function noteAuthorForAttachment(file, attachment) {
  if (!file || !attachment) return null;
  const notes = file.notes || [];
  const walk = (list) => {
    for (const note of list) {
      if ((note.attachments || []).some((a) => a.id === attachment.id) || note.id === attachment.noteId) {
        return note.author?.id || null;
      }
      const nested = walk(note.replies || []);
      if (nested) return nested;
    }
    return null;
  };
  return walk(notes);
}

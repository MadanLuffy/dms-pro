export function canDeleteSubjectFile(user, file) {
  if (!user || !file) return false;
  if (user.role === 'SUPERADMIN') return false;
  if (user.id !== file.creator?.id) return false;
  if (file.status === 'APPROVED') return false;
  return true;
}

export function homePath(user) {
  return user?.role === 'SUPERADMIN' ? '/admin' : '/files';
}

export function isAdmin(user) {
  return user?.role === 'SUPERADMIN';
}

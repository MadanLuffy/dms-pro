function isPostgres() {
  const url = process.env.DATABASE_URL || '';
  return url.startsWith('postgres://') || url.startsWith('postgresql://');
}

export function contains(value) {
  if (value == null || value === '') return undefined;
  if (isPostgres()) return { contains: String(value), mode: 'insensitive' };
  return { contains: String(value) };
}

export function parsePagination(query = {}, { defaultSize = 50, maxSize = 100 } = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const pageSize = Math.min(
    maxSize,
    Math.max(1, Number.parseInt(query.pageSize || query.limit, 10) || defaultSize)
  );
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function txOptions() {
  return isPostgres() ? { isolationLevel: 'Serializable' } : undefined;
}

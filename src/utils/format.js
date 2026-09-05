export function getInitials(name) {
  if (!name) return 'U';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const STATUS_LABELS = {
  DRAFT: 'Draft',
  DEPT_HEAD_REVIEW: 'Department Review',
  CEO_REVIEW: 'CEO Review',
  APPROVED: 'Approved & Closed',
  RETURNED: 'Returned',
};

export function statusLabel(status) {
  return STATUS_LABELS[status] || status?.replace(/_/g, ' ') || '—';
}

export function cn(...args) {
  return args.filter(Boolean).join(' ');
}
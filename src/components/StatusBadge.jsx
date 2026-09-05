import { cn, statusLabel } from '../utils/format';

const STATUS_VARIANT = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  DEPT_HEAD_REVIEW: 'dept-head-review',
  CEO_REVIEW: 'ceo-review',
  APPROVED: 'approved',
  RETURNED: 'returned',
};

const PULSE = new Set(['DEPT_HEAD_REVIEW', 'CEO_REVIEW', 'SUBMITTED', 'PENDING']);

export default function StatusBadge({ status, size = 'md' }) {
  const variant = STATUS_VARIANT[status] || 'submitted';
  const showPulse = PULSE.has(status);
  return (
    <span
      className={cn('badge', `badge-${variant}`)}
      style={size === 'sm' ? { fontSize: '0.72rem' } : size === 'lg' ? { fontSize: '0.85rem', padding: '0.42rem 0.9rem' } : undefined}
    >
      {showPulse && <span className="badge-dot" aria-hidden="true" />}
      {statusLabel(status)}
    </span>
  );
}

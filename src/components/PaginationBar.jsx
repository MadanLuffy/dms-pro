export default function PaginationBar({ page = 1, pageSize = 50, total = 0, onPageChange }) {
  const pages = Math.max(1, Math.ceil((total || 0) / pageSize));
  if (!total) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="pagination-bar">
      <span className="pagination-meta">
        Showing {from}–{to} of {total}
      </span>
      <div className="pagination-actions">
        <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Previous
        </button>
        <span className="pagination-page">Page {page} / {pages}</span>
        <button type="button" className="btn btn-secondary btn-sm" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}

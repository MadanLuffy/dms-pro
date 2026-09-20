import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, Eye, Inbox } from 'lucide-react';
import { useFiles } from '../context/FilesContext';
import StatusBadge from '../components/StatusBadge';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import PaginationBar from '../components/PaginationBar';
import { formatDate } from '../utils/format';

const STATUS_FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'DEPT_HEAD_REVIEW', label: 'Department review' },
  { value: 'CEO_REVIEW', label: 'CEO review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'RETURNED', label: 'Returned' },
];

export default function FileListPage({ searchQuery = '' }) {
  const navigate = useNavigate();
  const { files, loading, loadFiles, pagination } = useFiles();
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [selectedStatus, searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadFiles({
        status: selectedStatus,
        q: searchQuery,
        page,
        pageSize: 50,
      });
    }, searchQuery ? 250 : 0);
    return () => clearTimeout(timer);
  }, [selectedStatus, searchQuery, page, loadFiles]);

  const hasFilters = selectedStatus !== 'ALL' || searchQuery.trim();

  const emptyTitle = useMemo(() => {
    if (hasFilters) return 'No files match this search.';
    return 'No files yet.';
  }, [hasFilters]);

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="glass-panel toolbar-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Filter size={14} /> Status
          </span>
          {STATUS_FILTERS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`filter-chip ${selectedStatus === opt.value ? 'is-active' : ''}`}
              onClick={() => setSelectedStatus(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="surface-card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <Spinner label="Loading files..." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>File No</th>
                  <th>Subject</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {files.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '2.5rem', cursor: 'default' }}>
                      <EmptyState
                        icon={Inbox}
                        title={emptyTitle}
                        hint={hasFilters ? 'Try a different status or search term.' : 'Use Create New File to add one.'}
                      />
                    </td>
                  </tr>
                ) : (
                  files.map((file) => (
                    <tr
                      key={file.id}
                      onClick={() => navigate(`/files/${file.id}`)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/files/${file.id}`); } }}
                      tabIndex={0}
                    >
                      <td className="ref-no">{file.refNo}</td>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{file.subject}</div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-light)', marginTop: '0.2rem' }}>
                          Created by {file.creator?.name} ({file.creator?.departmentName})
                          {file.createdAt ? ` · ${formatDate(file.createdAt)}` : ''}
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={file.status} />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button onClick={(e) => { e.stopPropagation(); navigate(`/files/${file.id}`); }} className="btn btn-primary btn-sm">
                          <Eye size={15} /> Open File
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <PaginationBar
              page={pagination.page}
              pageSize={pagination.pageSize}
              total={pagination.total}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, Eye, Inbox } from 'lucide-react';
import { useFiles } from '../context/FilesContext';
import { api } from '../lib/api';
import StatusBadge from '../components/StatusBadge';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import PaginationBar from '../components/PaginationBar';
import { formatDate } from '../utils/format';

export default function FileListPage({ searchQuery = '', onSearchChange }) {
  const navigate = useNavigate();
  const { files, loading, loadFiles, pagination } = useFiles();
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    api.meta.departments().then(({ departments: d }) => setDepartments(d || [])).catch(() => {});
  }, []);

  useEffect(() => {
    setPage(1);
  }, [selectedDept, selectedStatus, searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadFiles({
        department: selectedDept,
        status: selectedStatus,
        q: searchQuery,
        page,
        pageSize: 50,
      });
    }, searchQuery ? 250 : 0);
    return () => clearTimeout(timer);
  }, [selectedDept, selectedStatus, searchQuery, page, loadFiles]);

  const hasFilters = selectedDept !== 'ALL' || selectedStatus !== 'ALL' || searchQuery.trim();

  const emptyTitle = useMemo(() => {
    if (hasFilters) return 'No subject files match your filter search.';
    return 'No subject files in the registry yet.';
  }, [hasFilters]);

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
      <div className="glass-panel" style={{ padding: '1rem 1.2rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Filter size={16} /> Filter Files
          </span>
          <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)} aria-label="Filter by department" className="field-control" style={{ width: 'auto' }}>
            <option value="ALL">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name} ({d.id})</option>
            ))}
          </select>
          <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} aria-label="Filter by status" className="field-control" style={{ width: 'auto' }}>
            <option value="ALL">All Statuses</option>
            <option value="DEPT_HEAD_REVIEW">In Department Review</option>
            <option value="CEO_REVIEW">In CEO Review</option>
            <option value="APPROVED">Fully Approved</option>
            <option value="RETURNED">Returned</option>
          </select>
          <input
            type="search"
            aria-label="Search files"
            placeholder="Search..."
            className="field-control"
            style={{ width: 200 }}
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
          />
        </div>
        <div style={{ fontSize: '0.875rem', color: 'var(--text-light)' }}>
          Total Files: <strong>{pagination.total}</strong>
        </div>
      </div>

      <div className="surface-card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <Spinner label="Loading file registry..." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>File Reference No</th>
                  <th>Subject Details</th>
                  <th>Target Depts</th>
                  <th>Current Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {files.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '2.5rem', cursor: 'default' }}>
                      <EmptyState
                        icon={Inbox}
                        title={emptyTitle}
                        hint={hasFilters ? 'Try a different department, status, or search term.' : 'Create a new file to start an approval trail.'}
                      />
                    </td>
                  </tr>
                ) : (
                  files.map((file) => (
                    <tr key={file.id} onClick={() => navigate(`/files/${file.id}`)}>
                      <td className="ref-no">{file.refNo}</td>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{file.subject}</div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-light)', marginTop: '0.2rem' }}>
                          Raised by {file.creator?.name} ({file.creator?.departmentName})
                          {file.createdAt ? ` · ${formatDate(file.createdAt)}` : ''}
                        </div>
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                          {file.targetDepts.map((d) => (
                            <span key={d.id} className="badge badge-submitted" style={{ fontSize: '0.68rem' }}>{d.name}</span>
                          ))}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          <span className={`priority-tag priority-${(file.priority || 'normal').toLowerCase()}`}>{file.priority}</span>
                          <span className={`secrecy-pill secrecy-${(file.secrecy || 'internal').toLowerCase()}`}>{file.secrecy}</span>
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

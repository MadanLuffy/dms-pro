import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, Eye, Inbox, Printer, RefreshCw, FolderArchive, Clock, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useFiles } from '../context/FilesContext';
import StatusBadge from '../components/StatusBadge';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import PaginationBar from '../components/PaginationBar';
import { formatDate } from '../utils/format';

const STATUS_FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'DEPT_HEAD_REVIEW', label: 'Department review' },
  { value: 'CEO_REVIEW', label: 'MD / CEO review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'RETURNED', label: 'Returned' },
];

export default function FileListPage({ searchQuery = '' }) {
  const navigate = useNavigate();
  const { files, loading, loadFiles, pagination } = useFiles();
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);

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

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      await loadFiles({
        status: selectedStatus,
        q: searchQuery,
        page,
        pageSize: 50,
      });
    } finally {
      setTimeout(() => setRefreshing(false), 400);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // KPI Dashboard Counts
  const statCounts = useMemo(() => {
    const counts = { all: pagination.total || files.length, dept: 0, ceo: 0, approved: 0 };
    for (const f of files) {
      if (f.status === 'DEPT_HEAD_REVIEW') counts.dept++;
      else if (f.status === 'CEO_REVIEW') counts.ceo++;
      else if (f.status === 'APPROVED') counts.approved++;
    }
    return counts;
  }, [files, pagination.total]);

  const hasFilters = selectedStatus !== 'ALL' || searchQuery.trim();

  const emptyTitle = useMemo(() => {
    if (hasFilters) return 'No files match this search.';
    return 'No files yet.';
  }, [hasFilters]);

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
      {/* 1. Executive KPI Dashboard */}
      <div className="gov-stat-grid">
        {/* Card 1: Total Registered Files */}
        <button
          type="button"
          className={`gov-stat-card theme-navy ${selectedStatus === 'ALL' ? 'is-active' : ''}`}
          onClick={() => setSelectedStatus('ALL')}
          title="Filter all registered files"
        >
          <div className="gov-stat-content">
            <span className="gov-stat-label-en" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Total Registered Files</span>
            <span className="gov-stat-num">{statCounts.all}</span>
          </div>
          <div className="gov-stat-icon-wrap">
            <FolderArchive size={22} />
          </div>
        </button>

        {/* Card 2: Department Review */}
        <button
          type="button"
          className={`gov-stat-card theme-amber ${selectedStatus === 'DEPT_HEAD_REVIEW' ? 'is-active' : ''}`}
          onClick={() => setSelectedStatus('DEPT_HEAD_REVIEW')}
          title="Filter files pending Department Head review"
        >
          <div className="gov-stat-content">
            <span className="gov-stat-label-en" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Dept Head Review</span>
            <span className="gov-stat-num">{statCounts.dept}</span>
          </div>
          <div className="gov-stat-icon-wrap">
            <Clock size={22} />
          </div>
        </button>

        {/* Card 3: MD Review */}
        <button
          type="button"
          className={`gov-stat-card theme-purple ${selectedStatus === 'CEO_REVIEW' ? 'is-active' : ''}`}
          onClick={() => setSelectedStatus('CEO_REVIEW')}
          title="Filter files pending MD / CEO review"
        >
          <div className="gov-stat-content">
            <span className="gov-stat-label-en" style={{ fontSize: '0.8rem', fontWeight: 600 }}>MD / CEO Approval</span>
            <span className="gov-stat-num">{statCounts.ceo}</span>
          </div>
          <div className="gov-stat-icon-wrap">
            <ShieldAlert size={22} />
          </div>
        </button>

        {/* Card 4: Approved & Dispatched */}
        <button
          type="button"
          className={`gov-stat-card theme-green ${selectedStatus === 'APPROVED' ? 'is-active' : ''}`}
          onClick={() => setSelectedStatus('APPROVED')}
          title="Filter approved and finalized files"
        >
          <div className="gov-stat-content">
            <span className="gov-stat-label-en" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Approved & Closed</span>
            <span className="gov-stat-num">{statCounts.approved}</span>
          </div>
          <div className="gov-stat-icon-wrap">
            <CheckCircle2 size={22} />
          </div>
        </button>
      </div>

      {/* 2. Enterprise Toolbar & Filter Strip */}
      <div className="glass-panel toolbar-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.8rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Filter size={14} style={{ color: '#0b4f8a' }} /> ಶೋಧಕ / Status Filter:
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={handleManualRefresh}
            className="btn btn-secondary btn-sm"
            title="Refresh Registry"
            disabled={refreshing}
          >
            <RefreshCw size={13} className={refreshing ? 'spin' : ''} />
            ತಾಜಾಗೊಳಿಸಿ (Refresh)
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="btn btn-secondary btn-sm"
            title="Print File Movement Register"
          >
            <Printer size={13} />
            ವಹಿ ಮುದ್ರಿಸಿ (Print Register)
          </button>
        </div>
      </div>

      {/* 3. File Movement Register Card */}
      <div className="surface-card" style={{ overflow: 'hidden', borderTop: '2px solid var(--primary)' }}>
        <div style={{ padding: '0.75rem 1.1rem', background: 'var(--bg-muted)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a' }} />
            <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-main)' }}>
              File Movement Registry
            </span>
          </div>
          <span style={{ fontSize: '0.76rem', color: 'var(--text-light)', fontWeight: 600 }}>
            Total Files: <strong style={{ color: 'var(--text-main)' }}>{pagination.total || files.length}</strong>
          </span>
        </div>

        {loading ? (
          <Spinner label="Loading files..." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 140 }}>ಕಡತ ಸಂಖ್ಯೆ / File No</th>
                  <th>ವಿಷಯ / Subject</th>
                  <th style={{ minWidth: 160 }}>ಪ್ರಸ್ತುತ ಸ್ಥಿತಿ / Status</th>
                  <th style={{ textAlign: 'right', minWidth: 130 }}>ಕ್ರಮ / Action</th>
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
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <span className="ref-no" style={{ fontWeight: 800 }}>{file.refNo}</span>
                          {file.priority && (
                            <span className={`priority-tag priority-${file.priority?.toLowerCase()}`} style={{ alignSelf: 'flex-start', fontSize: '0.66rem' }}>
                              {file.priority}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.88rem' }}>{file.subject}</div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-light)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <span className="badge badge-submitted" style={{ fontSize: '0.68rem', padding: '0.1rem 0.45rem' }}>
                            {file.creator?.departmentName || file.creator?.deptId || 'Section'}
                          </span>
                          <span>ಪ್ರಾರಂಭಿಸಿದವರು: <strong>{file.creator?.name}</strong></span>
                          {file.createdAt && <span>· {formatDate(file.createdAt)}</span>}
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={file.status} />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/files/${file.id}`); }}
                          className="btn btn-primary btn-sm"
                          style={{ padding: '0.4rem 0.85rem' }}
                        >
                          <Eye size={14} /> Open File
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

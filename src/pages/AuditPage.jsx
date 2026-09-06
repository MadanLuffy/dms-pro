import { useCallback, useEffect, useRef, useState } from 'react';
import { Shield, Download, Search, Clock, ScrollText } from 'lucide-react';
import { api } from '../lib/api';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import PaginationBar from '../components/PaginationBar';
import { formatDate } from '../utils/format';

const ACTIONS = [
  'ALL',
  'LOGIN',
  'LOGOUT',
  'FILE_CREATED',
  'NOTE_ADDED',
  'DEPT_APPROVED',
  'CEO_APPROVED',
  'FILE_RETURNED',
  'FILE_RESUBMITTED',
  'FILE_DELETED',
  'DEPT_CREATED',
  'USER_CREATED',
  'USER_UPDATED',
];

export default function AuditPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('ALL');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 50, total: 0 });
  const debounceRef = useRef(null);

  const load = useCallback(async (actionFilter, q, pageNum = 1) => {
    setLoading(true);
    try {
      const data = await api.audit.list({ action: actionFilter, q, page: pageNum, pageSize: 50 });
      setLogs(data.logs || []);
      setPagination({
        page: data.page || pageNum,
        pageSize: data.pageSize || 50,
        total: data.total ?? (data.logs || []).length,
      });
    } catch {
      setLogs([]);
      setPagination({ page: 1, pageSize: 50, total: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPage(1);
  }, [action, query]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(action, query, page), query ? 350 : 0);
    return () => clearTimeout(debounceRef.current);
  }, [action, query, page, load]);

  const exportCSV = () => {
    const rows = [['ID', 'Timestamp', 'User', 'Action', 'Details', 'IP']];
    for (const log of logs) {
      rows.push([log.id, new Date(log.createdAt).toISOString(), log.userName, log.action, (log.details || '').replace(/"/g, "'"), log.ipAddress || '']);
    }
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `DMS_Pro_Audit_Log_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Shield size={22} style={{ color: 'var(--primary)' }} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Administrative Audit & System Traceability</h2>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Immutable audit trail of all user actions and sign-offs.</p>
        </div>
        <button onClick={exportCSV} className="btn btn-secondary">
          <Download size={16} /> Export This Page (CSV)
        </button>
      </div>

      <div className="glass-panel" style={{ padding: '0.9rem 1.1rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.85rem' }}>
        <div className="search-field" style={{ flex: '1 1 240px', maxWidth: 360 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
          <input type="search" aria-label="Search audit logs" placeholder="Search user, file, details..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select value={action} onChange={(e) => setAction(e.target.value)} aria-label="Filter by action" className="field-control" style={{ width: 'auto' }}>
          {ACTIONS.map((a) => <option key={a} value={a}>{a === 'ALL' ? 'All Actions' : a.replace(/_/g, ' ')}</option>)}
        </select>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginLeft: 'auto' }}>Total Log Entries: <strong>{pagination.total}</strong></div>
      </div>

      <div className="surface-card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <Spinner label="Loading audit trail..." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Details</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: '2.5rem', cursor: 'default' }}>
                    <EmptyState icon={ScrollText} title="No audit log records found." hint="Actions such as login, file creation, and approvals appear here." />
                  </td></tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} style={{ cursor: 'default' }}>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        <Clock size={12} style={{ display: 'inline', marginRight: 4 }} /> {formatDate(log.createdAt)}
                      </td>
                      <td style={{ fontWeight: 600 }}>{log.userName}</td>
                      <td>
                        <span className="badge badge-submitted" style={{ fontSize: '0.7rem' }}>{log.action.replace(/_/g, ' ')}</span>
                      </td>
                      <td style={{ maxWidth: 480 }}>
                        <span style={{ fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{log.details}</span>
                      </td>
                      <td className="ref-no" style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{log.ipAddress || '—'}</td>
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

import { useEffect, useMemo, useState } from 'react';
import { Building2, UserPlus, Loader2, Pencil, Shield } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { formatDate } from '../utils/format';

const ROLES = ['STAFF', 'DEPT_HEAD', 'CEO', 'SUPERADMIN'];

const emptyUser = {
  name: '',
  email: '',
  password: '',
  role: 'STAFF',
  deptId: '',
};

export default function AdminPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');

  const [deptId, setDeptId] = useState('');
  const [deptName, setDeptName] = useState('');
  const [deptBusy, setDeptBusy] = useState(false);

  const [userForm, setUserForm] = useState(emptyUser);
  const [userBusy, setUserBusy] = useState(false);

  const [editUser, setEditUser] = useState(null);
  const [editBusy, setEditBusy] = useState(false);

  const load = async () => {
    setError('');
    try {
      const data = await api.admin.directory();
      setDepartments(data.departments || []);
      setUsers(data.users || []);
    } catch (err) {
      setError(err.message || 'Failed to load directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const defaultDeptId = useMemo(() => departments[0]?.id || '', [departments]);

  useEffect(() => {
    setUserForm((prev) => (prev.deptId || !defaultDeptId ? prev : { ...prev, deptId: defaultDeptId }));
  }, [defaultDeptId]);

  const handleCreateDept = async (e) => {
    e.preventDefault();
    setDeptBusy(true);
    try {
      const { department } = await api.admin.createDepartment({ id: deptId, name: deptName });
      toast(`Department ${department.id} created`, 'success');
      setDeptId('');
      setDeptName('');
      await load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setDeptBusy(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setUserBusy(true);
    try {
      const { user } = await api.admin.createUser(userForm);
      toast(`${user.name} added as ${user.role.replace(/_/g, ' ')}`, 'success');
      setUserForm({ ...emptyUser, deptId: defaultDeptId });
      await load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setUserBusy(false);
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editUser) return;
    setEditBusy(true);
    try {
      const payload = {
        name: editUser.name,
        role: editUser.role,
        deptId: editUser.deptId,
      };
      if (editUser.password) payload.password = editUser.password;
      await api.admin.updateUser(editUser.id, payload);
      toast('User updated', 'success');
      setEditUser(null);
      await load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setEditBusy(false);
    }
  };

  if (loading) return <Spinner label="Loading administration..." />;

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Shield size={22} style={{ color: 'var(--primary)' }} />
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Administration</h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 4 }}>
          Create departments and user accounts. File review and approval stay with department heads and the CEO.
        </p>
      </div>

      {error && <div role="alert" className="alert alert-error">{error}</div>}

      <div className="admin-grid">
        <form className="glass-panel admin-card" onSubmit={handleCreateDept}>
          <h2><Building2 size={18} /> New Department</h2>
          <label htmlFor="dept-id" className="field-label">Department ID</label>
          <input
            id="dept-id"
            className="field-control"
            value={deptId}
            onChange={(e) => setDeptId(e.target.value.toUpperCase())}
            placeholder="e.g. PROCUREMENT"
            maxLength={20}
          />
          <label htmlFor="dept-name" className="field-label">Department Name</label>
          <input
            id="dept-name"
            className="field-control"
            value={deptName}
            onChange={(e) => setDeptName(e.target.value)}
            placeholder="e.g. Procurement"
            required
          />
          <p className="field-hint">ID is auto-derived from the name if left blank (A–Z, 0–9, underscore).</p>
          <button type="submit" className="btn btn-primary" disabled={deptBusy}>
            {deptBusy ? <Loader2 size={16} className="spin" /> : <Building2 size={16} />}
            {deptBusy ? 'Saving...' : 'Create Department'}
          </button>
        </form>

        <form className="glass-panel admin-card" onSubmit={handleCreateUser}>
          <h2><UserPlus size={18} /> New User</h2>
          <label htmlFor="user-name" className="field-label">Full Name</label>
          <input id="user-name" className="field-control" value={userForm.name} onChange={(e) => setUserForm((f) => ({ ...f, name: e.target.value }))} required />
          <label htmlFor="user-email" className="field-label">Email</label>
          <input id="user-email" type="email" className="field-control" value={userForm.email} onChange={(e) => setUserForm((f) => ({ ...f, email: e.target.value }))} required />
          <label htmlFor="user-password" className="field-label">Temporary Password</label>
          <input id="user-password" type="password" className="field-control" value={userForm.password} onChange={(e) => setUserForm((f) => ({ ...f, password: e.target.value }))} minLength={8} required />
          <div className="form-grid-2">
            <div>
              <label htmlFor="user-role" className="field-label">Role</label>
              <select id="user-role" className="field-control" value={userForm.role} onChange={(e) => setUserForm((f) => ({ ...f, role: e.target.value }))}>
                {ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="user-dept" className="field-label">Department</label>
              <select id="user-dept" className="field-control" value={userForm.deptId} onChange={(e) => setUserForm((f) => ({ ...f, deptId: e.target.value }))} required>
                <option value="">Select department</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.id})</option>)}
              </select>
            </div>
          </div>
          <button type="submit" className="btn btn-success" disabled={userBusy || !departments.length}>
            {userBusy ? <Loader2 size={16} className="spin" /> : <UserPlus size={16} />}
            {userBusy ? 'Saving...' : 'Create User'}
          </button>
        </form>
      </div>

      <div className="surface-card" style={{ overflow: 'hidden' }}>
        <div className="admin-section-head">Departments ({departments.length})</div>
        {departments.length === 0 ? (
          <EmptyState title="No departments yet" hint="Create a department before adding users." />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Users</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((d) => (
                <tr key={d.id} style={{ cursor: 'default' }}>
                  <td className="ref-no">{d.id}</td>
                  <td>{d.name}</td>
                  <td>{d.userCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="surface-card" style={{ overflow: 'hidden' }}>
        <div className="admin-section-head">Users ({users.length})</div>
        {users.length === 0 ? (
          <EmptyState title="No users yet" hint="Create a staff, department head, or CEO account." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ cursor: 'default' }}>
                    <td style={{ fontWeight: 700 }}>{u.name}</td>
                    <td>{u.email}</td>
                    <td><span className="badge badge-submitted">{u.role.replace(/_/g, ' ')}</span></td>
                    <td>{u.departmentName} ({u.deptId})</td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>{formatDate(u.createdAt)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditUser({ ...u, password: '' })}>
                        <Pencil size={13} /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={!!editUser} onClose={() => setEditUser(null)} title="Edit user">
        {editUser && (
          <form onSubmit={handleUpdateUser} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <label className="field-label" htmlFor="edit-name">Name</label>
            <input id="edit-name" className="field-control" value={editUser.name} onChange={(e) => setEditUser((u) => ({ ...u, name: e.target.value }))} required />
            <label className="field-label" htmlFor="edit-role">Role</label>
            <select id="edit-role" className="field-control" value={editUser.role} onChange={(e) => setEditUser((u) => ({ ...u, role: e.target.value }))}>
              {ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
            </select>
            <label className="field-label" htmlFor="edit-dept">Department</label>
            <select id="edit-dept" className="field-control" value={editUser.deptId} onChange={(e) => setEditUser((u) => ({ ...u, deptId: e.target.value }))}>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.id})</option>)}
            </select>
            <label className="field-label" htmlFor="edit-password">Reset password (optional)</label>
            <input id="edit-password" type="password" className="field-control" value={editUser.password} onChange={(e) => setEditUser((u) => ({ ...u, password: e.target.value }))} minLength={8} placeholder="Leave blank to keep current password" />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setEditUser(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={editBusy}>
                {editBusy ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

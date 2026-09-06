import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, User, X, Loader2, Paperclip, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { wrapLocalFiles, toUploadFiles, removePendingFile } from '../utils/pendingFiles';

const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
const SECRECY_LEVELS = ['OPEN', 'INTERNAL', 'CONFIDENTIAL', 'SECRET'];

export default function NewFilePage({ onClose }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [subject, setSubject] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [secrecy, setSecrecy] = useState('INTERNAL');
  const [assignedOfficerId, setAssignedOfficerId] = useState('');
  const [targetDeptIds, setTargetDeptIds] = useState([]);
  const [initialNote, setInitialNote] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    api.meta.users().then(({ users: u }) => setUsers(u || [])).catch(() => {});
    api.meta.departments().then(({ departments: d }) => setDepartments(d || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (user?.deptId && targetDeptIds.length === 0) {
      setTargetDeptIds([user.deptId]);
    }
  }, [user, targetDeptIds.length]);

  const higherOfficers = users.filter((u) => ['DEPT_HEAD', 'CEO'].includes(u.role));

  const toggleDept = (id) => {
    setTargetDeptIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        return prev.filter((d) => d !== id);
      }
      return [...prev, id];
    });
  };

  const close = () => (onClose ? onClose() : navigate('/files'));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!subject.trim()) {
      setError('Subject title is required.');
      return;
    }
    setBusy(true);
    try {
      const { file } = await api.files.create({
        subject: subject.trim(),
        priority,
        secrecy,
        assignedOfficerId: assignedOfficerId || null,
        targetDeptIds,
        initialNote: initialNote.trim(),
        attachments: toUploadFiles(attachments),
      });
      toast(`File ${file.refNo} created`, 'success');
      if (onClose) onClose();
      navigate(`/files/${file.id}`, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 780, maxHeight: '92vh', padding: 0, overflow: 'hidden' }}>
        <div className="modal-hero">
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>Create New Subject File</h3>
            <p style={{ fontSize: '0.8rem', color: '#dbeafe', margin: '0.2rem 0 0 0' }}>Set routing, minute, and attachments in one step</p>
          </div>
          <button onClick={close} aria-label="Close" className="btn btn-secondary btn-sm" style={{ padding: '0.35rem', background: 'rgba(255,255,255,0.18)', border: 'none', color: '#ffffff' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.15rem', maxHeight: 'calc(92vh - 80px)' }}>
          {error && <div role="alert" className="alert alert-error">{error}</div>}

          <div>
            <label htmlFor="subject" className="field-label">Subject Title Baseline *</label>
            <input id="subject" className="field-control" type="text" required placeholder="e.g. Enterprise Cloud Server Infrastructure Upgrade & Procurement FY26" value={subject} onChange={(e) => setSubject(e.target.value)} style={{ fontWeight: 600, fontSize: '0.95rem' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.35rem', display: 'block' }}>This title acts as the official baseline header for the file.</span>
          </div>

          <div className="form-grid-3" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr', gap: '1rem' }}>
            <div>
              <label htmlFor="recipient" className="field-label">
                <User size={15} style={{ display: 'inline', marginRight: 4, verticalAlign: '-2px', color: 'var(--primary)' }} /> Assign To
              </label>
              <select id="recipient" className="field-control" value={assignedOfficerId} onChange={(e) => setAssignedOfficerId(e.target.value)} style={{ fontWeight: 600 }}>
                <option value="">— Not assigned —</option>
                {higherOfficers.map((o) => (
                  <option key={o.id} value={o.id}>{o.name} ({o.role.replace(/_/g, ' ')} - {o.departmentName || o.deptId})</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="priority" className="field-label">Priority</label>
              <select id="priority" className="field-control" value={priority} onChange={(e) => setPriority(e.target.value)}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="secrecy" className="field-label">Secrecy</label>
              <select id="secrecy" className="field-control" value={secrecy} onChange={(e) => setSecrecy(e.target.value)}>
                {SECRECY_LEVELS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <span className="field-label">Target Departments</span>
            <div className="chip-group" role="group" aria-label="Target departments">
              {departments.map((d) => {
                const active = targetDeptIds.includes(d.id);
                return (
                  <button key={d.id} type="button" className={`chip ${active ? 'is-active' : ''}`} onClick={() => toggleDept(d.id)}>
                    {active ? '✓ ' : ''}{d.name}
                  </button>
                );
              })}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.4rem', display: 'block' }}>
              Selected departments form the parallel approval matrix.
            </span>
          </div>

          <div>
            <label htmlFor="initial-note" className="field-label">Initial Minute (optional)</label>
            <textarea id="initial-note" className="field-control" rows={3} placeholder="Opening note for the approval chain…" value={initialNote} onChange={(e) => setInitialNote(e.target.value)} />
          </div>

          <div>
            <label className="field-label">Attachments (optional)</label>
            <input
              ref={fileInputRef}
              id="initial-attachments"
              type="file"
              multiple
              accept=".pdf,application/pdf,.docx,.xlsx,.csv,image/*"
              onChange={(e) => {
                const wrapped = wrapLocalFiles(e.target.files);
                setAttachments((prev) => [...prev, ...wrapped]);
                e.target.value = '';
              }}
              style={{ display: 'none' }}
            />
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()}>
              <Paperclip size={14} /> Attach Documents
            </button>
            {attachments.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.65rem' }}>
                {attachments.map((a) => (
                  <div key={a.id} className="pending-file">
                    <span style={{ fontWeight: 600, color: 'var(--primary-deep)' }}>{a.name}</span>
                    <button type="button" aria-label={`Remove ${a.name}`} onClick={() => setAttachments((prev) => removePendingFile(prev, a.id))} style={{ border: 'none', background: 'transparent', color: 'var(--danger)', cursor: 'pointer' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
            <button type="button" onClick={close} className="btn btn-secondary">Cancel</button>
            <button type="submit" disabled={busy} className="btn btn-success">
              {busy ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
              {busy ? 'Creating...' : 'Create File'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

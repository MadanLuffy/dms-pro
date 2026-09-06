import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, User, X, Loader2, Paperclip, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import { wrapLocalFiles, toUploadFiles, removePendingFile } from '../utils/pendingFiles';

export default function NewFilePage({ onClose }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [subject, setSubject] = useState('');
  const [assignedOfficerId, setAssignedOfficerId] = useState('');
  const [initialNote, setInitialNote] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [users, setUsers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    api.meta.users().then(({ users: u }) => setUsers(u || [])).catch(() => {});
  }, []);

  const higherOfficers = users.filter((u) => ['DEPT_HEAD', 'CEO'].includes(u.role));

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
        assignedOfficerId: assignedOfficerId || null,
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
      <div className="modal-content" style={{ maxWidth: 720, maxHeight: '92vh', padding: 0, overflow: 'hidden' }}>
        <div className="modal-hero">
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>Create New Subject File</h3>
            <p style={{ fontSize: '0.8rem', color: '#dbeafe', margin: '0.2rem 0 0 0' }}>Start a file. Choose departments when you send a note for confirmation.</p>
          </div>
          <button onClick={close} aria-label="Close" className="btn btn-secondary btn-sm" style={{ padding: '0.35rem', background: 'rgba(255,255,255,0.18)', border: 'none', color: '#ffffff' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.15rem', maxHeight: 'calc(92vh - 80px)' }}>
          {error && <div role="alert" className="alert alert-error">{error}</div>}

          <div>
            <label htmlFor="subject" className="field-label">Subject Title *</label>
            <input id="subject" className="field-control" type="text" required placeholder="e.g. Enterprise Cloud Server Infrastructure Upgrade" value={subject} onChange={(e) => setSubject(e.target.value)} style={{ fontWeight: 600, fontSize: '0.95rem' }} />
          </div>

          <div>
            <label htmlFor="recipient" className="field-label">
              <User size={15} style={{ display: 'inline', marginRight: 4, verticalAlign: '-2px', color: 'var(--primary)' }} /> Assign To (optional)
            </label>
            <select id="recipient" className="field-control" value={assignedOfficerId} onChange={(e) => setAssignedOfficerId(e.target.value)} style={{ fontWeight: 600 }}>
              <option value="">— Not assigned —</option>
              {higherOfficers.map((o) => (
                <option key={o.id} value={o.id}>{o.name} ({o.role.replace(/_/g, ' ')} - {o.departmentName || o.deptId})</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="initial-note" className="field-label">Opening minute (optional)</label>
            <textarea id="initial-note" className="field-control" rows={3} placeholder="Opening note…" value={initialNote} onChange={(e) => setInitialNote(e.target.value)} />
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

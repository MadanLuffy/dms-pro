import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, Shield, ShieldCheck, Check, X, Paperclip, Send, Trash2, ChevronRight, RefreshCw, Loader2, PenLine, MessageSquareReply, UserCog, MoreHorizontal, FileText, Clock, Printer } from 'lucide-react';
import { api } from '../lib/api';
import { EVENT_NAMES } from '../lib/events';
import { connectSocket, getSocket } from '../lib/socket';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { useFiles } from '../context/FilesContext';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import DocumentPreview from '../components/DocumentPreview';
import { formatDate, formatBytes, roleLabel } from '../utils/format';
import { wrapLocalFiles, toUploadFiles, removePendingFile } from '../utils/pendingFiles';
import { canDeleteSubjectFile } from '../utils/files';

function nestNoteTree(notes = []) {
  if (!notes.length) return [];
  if (!notes.some((n) => n.parentId)) return notes;
  const nodes = notes.map((n) => ({ ...n, replies: [] }));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const roots = [];
  for (const node of nodes) {
    if (node.parentId && byId.has(node.parentId)) byId.get(node.parentId).replies.push(node);
    else roots.push(node);
  }
  return roots;
}

function parseNoteContent(rawContent = '') {
  const str = String(rawContent || '');
  const titleMatch = str.match(/^Title:\s*(.+?)(?:\r?\n\r?\n|$)/i);
  if (titleMatch) {
    const title = titleMatch[1].trim();
    const body = str.slice(titleMatch[0].length).trim();
    return { title, body: body || title };
  }
  return { title: null, body: str };
}

export default function FileDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const { refreshFile, loadFiles } = useFiles();

  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteAttachments, setNewNoteAttachments] = useState([]);
  const [forwardRecipient, setForwardRecipient] = useState('');
  const [noteModal, setNoteModal] = useState(false);
  const [commentModal, setCommentModal] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteSearch, setNoteSearch] = useState('');
  const [users, setUsers] = useState([]);
  const [confirmDeptIds, setConfirmDeptIds] = useState([]);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignId, setReassignId] = useState('');
  const [reassignBusy, setReassignBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState('');
  const [previewAttachment, setPreviewAttachment] = useState(null);

  const fileInputRef = useRef(null);
  const menuRef = useRef(null);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const { file: f } = await api.files.get(id);
      setFile(f);
    } catch (err) {
      if (!silent) setError(err.message || 'Failed to load file');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api.meta.users().then(({ users: u }) => setUsers(u || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  useEffect(() => {
    const socket = getSocket() || connectSocket();
    if (!socket) return;
    const reload = (payload) => {
      if (payload?.fileId && payload.fileId !== id) return;
      load({ silent: true });
    };
    socket.on(EVENT_NAMES.NOTE_ADDED, reload);
    socket.on(EVENT_NAMES.NOTE_REPLY, reload);
    socket.on(EVENT_NAMES.ATTACHMENT_REMOVED, reload);
    return () => {
      socket.off(EVENT_NAMES.NOTE_ADDED, reload);
      socket.off(EVENT_NAMES.NOTE_REPLY, reload);
      socket.off(EVENT_NAMES.ATTACHMENT_REMOVED, reload);
    };
  }, [load, id]);

  const notesTree = useMemo(() => nestNoteTree(file?.notes || []), [file]);
  const rootNotes = useMemo(() => notesTree.filter((n) => !n.parentId), [notesTree]);

  const filteredRootNotes = useMemo(() => {
    if (!noteSearch.trim()) return rootNotes;
    const q = noteSearch.toLowerCase();
    return rootNotes.filter((n) => (n.content || '').toLowerCase().includes(q));
  }, [rootNotes, noteSearch]);

  const myDeptApproval = useMemo(
    () =>
      file?.approvalMatrix?.find(
        (a) => a.gate === 'DEPT' && a.status === 'PENDING' && a.deptId === user?.deptId
      ),
    [file, user]
  );
  const ceoApproval = useMemo(
    () => file?.approvalMatrix?.find((a) => a.gate === 'CEO' && a.status === 'PENDING'),
    [file]
  );
  const canApproveDept = user?.role === 'DEPT_HEAD' && !!myDeptApproval && file?.status === 'DEPT_HEAD_REVIEW';
  const canApproveCeo = user?.role === 'CEO' && !!ceoApproval && file?.status === 'CEO_REVIEW';
  const isCreator = file?.creator?.id === user?.id;
  const canResubmit = isCreator && file?.status === 'RETURNED';
  const canManageFile = isCreator;
  const canDeleteFile = canDeleteSubjectFile(user, file);
  const higherOfficers = users.filter((u) => ['DEPT_HEAD', 'CEO'].includes(u.role));

  const recipientValue = (o) => `${o.name} (${roleLabel(o.role)} - ${o.departmentName || o.deptId})`;

  const forwardRecipients = useMemo(() => {
    return users
      .filter((u) => u.id !== user?.id)
      .filter((u) => {
        if (user?.role === 'STAFF') {
          return u.role === 'DEPT_HEAD';
        }
        return true;
      });
  }, [users, user?.role, user?.id]);

  const handleRemoveNewAtt = (attId) => {
    setNewNoteAttachments((prev) => removePendingFile(prev, attId));
  };

  const canDeleteNote = (n) =>
    (user?.id === n.author?.id || user?.role === 'SUPERADMIN') &&
    !n.seenByHead &&
    (!n.replies || n.replies.length === 0);

  const handleDeleteNote = async (note) => {
    if (!note?.id) return;
    if (!window.confirm('Delete this note? This action cannot be undone.')) return;
    try {
      await api.files.deleteNote(id, note.id);
      toast('Note deleted', 'success');
      await load();
    } catch (err) {
      toast(err.message || 'Could not delete note', 'error');
    }
  };

  const handleAddNoteSubmit = async (e) => {
    e.preventDefault();
    if (!newNoteText.trim() && !newNoteTitle.trim() && newNoteAttachments.length === 0) return;
    setNoteBusy(true);
    try {
      let finalContent = newNoteText.trim();
      if (newNoteTitle.trim()) {
        finalContent = finalContent ? `Title: ${newNoteTitle.trim()}\n\n${finalContent}` : `Title: ${newNoteTitle.trim()}`;
      }
      const myDeptHead = users.find((u) => u.role === 'DEPT_HEAD' && u.deptId === user?.deptId);
      const effectiveSentTo = user?.role === 'STAFF'
        ? (myDeptHead ? `${myDeptHead.name} (${myDeptHead.role.replace(/_/g, ' ')})` : '')
        : (forwardRecipient || '');
      await api.files.addNote(id, {
        content: finalContent || `${newNoteAttachments.length} file(s) attached`,
        sentTo: effectiveSentTo,
        confirmDeptIds,
        attachments: toUploadFiles(newNoteAttachments),
      });
      toast('Note added', 'success');
      setNewNoteTitle('');
      setNewNoteText('');
      setNewNoteAttachments([]);
      setForwardRecipient('');
      setConfirmDeptIds([]);
      setNoteModal(false);
      await load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setNoteBusy(false);
    }
  };

  const handleDecide = async () => {
    if (!commentModal) return;
    setCommentBusy(true);
    try {
      const isCeoAction = commentModal === 'CEO_APPROVE' || commentModal === 'CEO_RETURN';
      const approval = isCeoAction ? ceoApproval : myDeptApproval;
      if (!approval) {
        toast('No pending approval available to decide', 'error');
        setCommentModal(null);
        return;
      }
      const decision = commentModal === 'CEO_APPROVE' || commentModal === 'APPROVE' ? 'approve' : 'return';
      await api.files.decide(id, { decision, approvalId: approval.id, comments: commentText.trim() });
      toast(decision === 'approve' ? 'Approval recorded' : 'File returned', 'success');
      setCommentModal(null);
      setCommentText('');
      await load();
      await refreshFile(id);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setCommentBusy(false);
    }
  };

  const handleResubmit = async () => {
    try {
      await api.files.update(id, { resubmit: true });
      toast('File resubmitted for review', 'success');
      await load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const handleReassign = async () => {
    if (!reassignId) return;
    setReassignBusy(true);
    try {
      await api.files.update(id, { assignedOfficerId: reassignId });
      toast('Officer reassigned', 'success');
      setReassignOpen(false);
      await load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setReassignBusy(false);
    }
  };

  const handleDelete = async () => {
    setDeleteBusy(true);
    try {
      await api.files.remove(id);
      toast('File deleted', 'success');
      await loadFiles();
      navigate('/files', { replace: true });
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleExport = async () => {
    setExportBusy('archival');
    try {
      const { generateFilePDFReport } = await import('../utils/pdfExport');
      await generateFilePDFReport(file);
      toast('PDF downloaded', 'success');
    } catch (err) {
      toast('PDF export failed: ' + err.message, 'error');
    } finally {
      setExportBusy('');
    }
  };

  const handleNotesExport = async () => {
    setExportBusy('notes');
    try {
      const { generateNotesSheetPDF } = await import('../utils/pdfExport');
      await generateNotesSheetPDF(file);
      toast('Notes PDF downloaded', 'success');
    } catch (err) {
      toast('Notes PDF export failed: ' + err.message, 'error');
    } finally {
      setExportBusy('');
    }
  };

  if (loading) return <Spinner label="Loading file..." />;
  if (error) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-light)' }}>
        <div style={{ margin: '0.5rem 0' }}>{error}</div>
        <button className="btn btn-primary" onClick={() => navigate('/files')}>Back to Files</button>
      </div>
    );
  }
  if (!file) return null;

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
      <div className="glass-panel file-hero">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', minWidth: 0 }}>
          <button onClick={() => navigate('/files')} className="btn btn-secondary btn-sm">
            <ArrowLeft size={16} /> Back to Files
          </button>
          <div style={{ minWidth: 0 }}>
            <div className="crumb" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
              <span>Files</span>
              <ChevronRight size={13} />
              <span>{file.creator?.departmentName}</span>
              <ChevronRight size={13} />
              <span className="ref-no">{file.refNo}</span>
              <span className={`priority-tag priority-${file.priority?.toLowerCase()}`}>{file.priority}</span>
              <span className={`secrecy-pill secrecy-${file.secrecy?.toLowerCase()}`}>{file.secrecy}</span>
            </div>
            <h1 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0.15rem 0 0' }}>{file.subject}</h1>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>Assigned Officer</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary-deep)' }}>{file.assignedOfficer?.name || 'Not assigned'}</div>
          </div>
          <StatusBadge status={file.status} size="lg" />
          {canResubmit && (
            <button
              type="button"
              onClick={handleResubmit}
              className="btn btn-primary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <RefreshCw size={14} /> Resubmit
            </button>
          )}
          <button onClick={handleExport} className="btn btn-secondary btn-sm" disabled={!!exportBusy}>
            {exportBusy === 'archival' ? <Loader2 size={15} className="spin" /> : <Download size={15} />}
            Export PDF
          </button>
          <button onClick={handleNotesExport} className="btn btn-secondary btn-sm" disabled={!!exportBusy}>
            {exportBusy === 'notes' ? <Loader2 size={15} className="spin" /> : <FileText size={15} />}
            Export Notes PDF
          </button>
          <button onClick={() => window.print()} className="btn btn-secondary btn-sm" title="Print File Docket">
            <Printer size={15} />
            Print Docket
          </button>
          {canDeleteFile && (
            <button type="button" onClick={() => setDeleteOpen(true)} className="btn btn-danger btn-sm">
              <Trash2 size={15} /> Delete File
            </button>
          )}
          {canManageFile && (
            <div style={{ position: 'relative' }} ref={menuRef}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMenuOpen((o) => !o)} aria-label="File actions">
                <MoreHorizontal size={16} />
              </button>
              {menuOpen && (
                <div className="profile-menu" style={{ width: 210 }}>
                  <button type="button" className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => { setMenuOpen(false); setReassignId(file.assignedOfficer?.id || ''); setReassignOpen(true); }}>
                    <UserCog size={14} /> Reassign Officer
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {(canApproveDept || canApproveCeo) && (
        <div className="signoff-banner" style={{ border: '2px solid #16a34a', background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', boxShadow: '0 4px 14px rgba(22, 163, 74, 0.18)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Shield size={18} style={{ color: '#15803d' }} />
              <strong style={{ fontSize: '0.92rem', color: '#166534' }}>
                Approval Pending
              </strong>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#334155', marginTop: '0.2rem', fontWeight: 600 }}>
              Authorized Reviewer: <strong>{user.name}</strong> ({roleLabel(user.role)})
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button type="button" onClick={() => setCommentModal(canApproveCeo ? 'CEO_APPROVE' : 'APPROVE')} className="btn btn-success" style={{ padding: '0.55rem 1.2rem', fontSize: '0.85rem' }}>
              <Check size={16} /> Approve & Sign
            </button>
            <button type="button" onClick={() => setCommentModal(canApproveCeo ? 'CEO_RETURN' : 'RETURN')} className="btn btn-danger" style={{ padding: '0.55rem 1.1rem', fontSize: '0.85rem' }}>
              <X size={16} /> Return Note
            </button>
          </div>
        </div>
      )}

      {/* Notes Section - Executive Office Style Note Index */}
      <div className="surface-card office-noting-section" style={{ padding: '1.1rem 1.25rem', borderTop: '3px solid #003366' }}>
        <div className="note-sheet-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', flexWrap: 'wrap', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.65rem', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#003366', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <FileText size={18} style={{ color: '#003366' }} />
              <span>Noting Minutes & Remarks</span>
              <span className="note-sheet-count" style={{ background: '#e0ecf7', color: '#003366', padding: '0.12rem 0.55rem', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700 }}>
                {rootNotes.length} {rootNotes.length === 1 ? 'note' : 'notes'}
              </span>
            </h2>
            {rootNotes.length > 2 && (
              <input
                type="text"
                placeholder="ಟಿಪ್ಪಣಿ ಹುಡುಕಿ / Search notes..."
                value={noteSearch}
                onChange={(e) => setNoteSearch(e.target.value)}
                style={{
                  padding: '0.2rem 0.55rem',
                  fontSize: '0.76rem',
                  borderRadius: 5,
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-subtle)',
                  outline: 'none',
                  width: 160
                }}
              />
            )}
          </div>
          <button type="button" onClick={() => { setConfirmDeptIds([]); setNewNoteTitle(''); setNoteModal(true); }} className="btn btn-primary btn-sm">
            <PenLine size={14} /> Write Note
          </button>
        </div>

        <div className="note-sheet" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {filteredRootNotes.length === 0 && (
            <p className="note-empty">{rootNotes.length === 0 ? <>No notes yet. Click <strong>Write Note</strong> to add one.</> : 'No notes match your search.'}</p>
          )}
          {filteredRootNotes.map((note, noteIdx) => {
            const parsed = parseNoteContent(note.content);
            const noteTitle = parsed.title || (note.content || '').split('\n')[0]?.trim() || `Note #${noteIdx + 1}`;
            return (
              <div
                key={note.id}
                data-testid="note-card"
                className="note-item office-note-title-box"
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/files/${id}/notes/${note.id}`)}
              >
                <div className="office-note-main">
                  <span className="office-note-num">Note #{noteIdx + 1}</span>
                  <FileText size={16} className="office-note-icon" />
                  <span className="office-note-title-text" title={noteTitle}>
                    {noteTitle}
                  </span>
                  {note.author?.id === user?.id && (
                    !note.seenByHead ? (
                      <span className="office-unseen-badge">
                        Unseen by Head
                      </span>
                    ) : (
                      <span className="office-seen-badge">
                        <Check size={11} style={{ color: 'var(--success)' }} /> Seen by Head
                      </span>
                    )
                  )}
                </div>

                <div className="office-note-side">
                  {canDeleteNote(note) && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDeleteNote(note); }}
                      className="btn btn-secondary btn-sm office-note-del-btn"
                      title="Delete note (unviewed by Head)"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  )}
                  <div className="office-note-open-cue">
                    <span>Open Note</span>
                    <ChevronRight size={15} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Modal
        open={!!commentModal}
        onClose={() => setCommentModal(null)}
        title={commentModal === 'RETURN' || commentModal === 'CEO_RETURN' ? 'Return file' : 'Confirm Authorization & Sign'}
        width={460}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', paddingBottom: '1.25rem' }}>
            <button onClick={() => setCommentModal(null)} className="btn btn-secondary">Cancel</button>
            <button onClick={handleDecide} disabled={commentBusy} className={`btn ${commentModal === 'RETURN' || commentModal === 'CEO_RETURN' ? 'btn-danger' : 'btn-success'}`}>
              {commentBusy ? <Loader2 size={16} className="spin" /> : <Check size={16} />} Confirm {commentModal === 'RETURN' || commentModal === 'CEO_RETURN' ? 'Return' : 'Approval'}
            </button>
          </div>
        }
      >
        <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '1rem' }}>
          Signing as <strong>{user?.name} ({roleLabel(user?.role)})</strong>.
        </p>
        <textarea rows={3} className="field-control" placeholder="Comment (optional)" value={commentText} onChange={(e) => setCommentText(e.target.value)} />
      </Modal>

      <Modal open={noteModal} onClose={() => { setNoteModal(false); setConfirmDeptIds([]); }} title="Write Note & Send" width={560}>
        <form onSubmit={handleAddNoteSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {user?.role !== 'STAFF' && (
            <div>
              <label htmlFor="fwd-recipient" className="field-label">
                Send to (optional)
              </label>
              <select
                id="fwd-recipient"
                className="field-control"
                value={forwardRecipient}
                onChange={(e) => {
                  const value = e.target.value;
                  setForwardRecipient(value);
                  const selected = users.find((u) => recipientValue(u) === value);
                  if (selected?.deptId) {
                    setConfirmDeptIds([selected.deptId]);
                  } else {
                    setConfirmDeptIds([]);
                  }
                }}
              >
                <option value="">— Select recipient —</option>
                {forwardRecipients.map((o) => (
                  <option key={o.id} value={recipientValue(o)}>{recipientValue(o)}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="note-title" className="field-label">Note Title (optional)</label>
            <input
              id="note-title"
              className="field-control"
              type="text"
              placeholder="e.g. Quality Inspection Report / Vendor Proposal"
              value={newNoteTitle}
              onChange={(e) => setNewNoteTitle(e.target.value)}
              style={{ fontWeight: 600 }}
            />
          </div>

          <div>
            <label htmlFor="note-text" className="field-label">Note</label>
            <textarea id="note-text" className="field-control" rows={4} placeholder="Write your note" value={newNoteText} onChange={(e) => setNewNoteText(e.target.value)} />
          </div>

          {newNoteAttachments.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {newNoteAttachments.map((a) => (
                <div key={a.id} className="pending-file">
                  <span style={{ fontWeight: 600, color: 'var(--primary-deep)' }}>{a.name}</span>
                  <button type="button" onClick={() => handleRemoveNewAtt(a.id)} aria-label={`Remove ${a.name}`} style={{ border: 'none', background: 'transparent', color: 'var(--danger)', cursor: 'pointer' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,application/pdf,.docx,.xlsx,.csv,image/*"
              onChange={(e) => {
                const wrapped = wrapLocalFiles(e.target.files);
                setNewNoteAttachments((prev) => [...prev, ...wrapped]);
                e.target.value = '';
              }}
              style={{ display: 'none' }}
            />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
              <Paperclip size={14} /> Attach Documents
            </button>
            <button type="submit" disabled={noteBusy || (!newNoteText.trim() && newNoteAttachments.length === 0)} className="btn btn-primary" style={{ padding: '0.55rem 1.5rem', fontSize: '0.875rem' }}>
              {noteBusy ? <Loader2 size={15} className="spin" /> : <Send size={15} />} Send Note
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={reassignOpen}
        onClose={() => setReassignOpen(false)}
        title="Reassign Officer"
        width={460}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', paddingBottom: '1.25rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setReassignOpen(false)}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={reassignBusy || !reassignId} onClick={handleReassign}>
              {reassignBusy ? <Loader2 size={16} className="spin" /> : <UserCog size={16} />} Save Assignment
            </button>
          </div>
        }
      >
        <label htmlFor="reassign-officer" className="field-label">Assigned officer</label>
        <select id="reassign-officer" className="field-control" value={reassignId} onChange={(e) => setReassignId(e.target.value)}>
          <option value="">— Select officer —</option>
          {higherOfficers.map((o) => (
            <option key={o.id} value={o.id}>{o.name} ({roleLabel(o.role)} - {o.departmentName || o.deptId})</option>
          ))}
        </select>
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete File"
        width={440}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', paddingBottom: '1.25rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setDeleteOpen(false)}>Cancel</button>
            <button type="button" className="btn btn-danger" disabled={deleteBusy} onClick={handleDelete}>
              {deleteBusy ? <Loader2 size={16} className="spin" /> : <Trash2 size={16} />} Delete File
            </button>
          </div>
        }
      >
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          This will permanently remove <strong>{file.refNo}</strong> and its notes and attachments. Approved files cannot be deleted. This cannot be undone.
        </p>
      </Modal>

      <Modal
        open={!!previewAttachment}
        onClose={() => setPreviewAttachment(null)}
        title={previewAttachment ? `Document Preview: ${previewAttachment.filename}` : 'Document Preview'}
        width={850}
      >
        {previewAttachment && (
          <div style={{ minHeight: 460 }}>
            <DocumentPreview attachment={previewAttachment} />
          </div>
        )}
      </Modal>
    </div>
  );
}

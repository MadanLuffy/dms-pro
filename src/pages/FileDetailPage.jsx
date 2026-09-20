import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, Shield, Check, X, Paperclip, Send, Trash2, ChevronRight, RefreshCw, Loader2, PenLine, MessageSquareReply, UserCog, MoreHorizontal, FileText, Clock } from 'lucide-react';
import { api } from '../lib/api';
import { EVENT_NAMES } from '../lib/events';
import { connectSocket, getSocket } from '../lib/socket';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { useFiles } from '../context/FilesContext';
import StatusBadge from '../components/StatusBadge';
import DocumentPreview from '../components/DocumentPreview';
import AttachmentChip from '../components/AttachmentChip';
import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import ErrorBoundary from '../components/ErrorBoundary';
import { formatDate } from '../utils/format';
import { wrapLocalFiles, toUploadFiles, removePendingFile } from '../utils/pendingFiles';
import { areAttachmentsLocked, canDeleteAttachment, noteAuthorForAttachment } from '../utils/attachments';
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

function roleText(role = '') {
  return String(role).replace(/_/g, ' ');
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

  const [activeAttIndex, setActiveAttIndex] = useState(0);
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
  const [deletingAttId, setDeletingAttId] = useState('');

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
      setActiveAttIndex((i) => (f.attachments.length ? Math.min(i, f.attachments.length - 1) : 0));
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

  const incomingAttachments = useMemo(() => file?.attachments || [], [file]);
  const activeAttachment = incomingAttachments[activeAttIndex] || null;
  const notesTree = useMemo(() => nestNoteTree(file?.notes || []), [file]);
  const rootNotes = useMemo(() => notesTree.filter((n) => !n.parentId), [notesTree]);

  const filteredRootNotes = useMemo(() => {
    if (!noteSearch.trim()) return rootNotes;
    const q = noteSearch.toLowerCase();
    return rootNotes.filter((n) => (n.content || '').toLowerCase().includes(q));
  }, [rootNotes, noteSearch]);
  const totalReplies = useMemo(() => {
    const countR = (list) => list.reduce((sum, n) => sum + (n.replies?.length || 0) + countR(n.replies || []), 0);
    return countR(rootNotes);
  }, [rootNotes]);

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
  const attachmentsLocked = areAttachmentsLocked(file);
  const higherOfficers = users.filter((u) => ['DEPT_HEAD', 'CEO'].includes(u.role));

  const canDeleteAtt = (att, noteAuthorId) => canDeleteAttachment(user, file, att, noteAuthorId || noteAuthorForAttachment(file, att));

  const handleDeleteAttachment = async (att) => {
    if (!att?.id) return;
    if (!window.confirm(`Remove “${att.filename}” from this note? Other attachments stay.`)) return;
    setDeletingAttId(att.id);
    try {
      await api.files.removeAttachment(id, att.id);
      toast('Attachment removed', 'success');
      await load({ silent: true });
      await refreshFile(id);
    } catch (err) {
      toast(err.message || 'Could not remove attachment', 'error');
    } finally {
      setDeletingAttId('');
    }
  };

  const recipientValue = (o) => `${o.name} (${o.role.replace(/_/g, ' ')} - ${o.departmentName || o.deptId})`;

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
        <div className="signoff-banner">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Shield size={17} style={{ color: 'var(--success)' }} />
              <strong style={{ fontSize: '0.9rem', color: 'var(--success-deep)' }}>Approval pending</strong>
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>Sign as {user.name} ({user.role})</div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" onClick={() => setCommentModal(canApproveCeo ? 'CEO_APPROVE' : 'APPROVE')} className="btn btn-success">
              <Check size={16} /> Approve & Sign
            </button>
            <button type="button" onClick={() => setCommentModal(canApproveCeo ? 'CEO_RETURN' : 'RETURN')} className="btn btn-danger">
              <X size={16} /> Return Note
            </button>
          </div>
        </div>
      )}

      <div className="file-detail-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem', minWidth: 0 }}>
          <div className="surface-card" style={{ padding: '1.1rem 1.2rem' }}>
            <h2 style={{ fontSize: '0.9rem', fontWeight: 800, marginBottom: '0.65rem' }}>File details</h2>
            <div className="meta-grid">
              <div><span style={{ color: 'var(--text-light)' }}>Created by:</span> <strong>{file.creator?.name}</strong></div>
              <div><span style={{ color: 'var(--text-light)' }}>Created:</span> <strong>{formatDate(file.createdAt)}</strong></div>
            </div>
          </div>

          <div className="surface-card" style={{ padding: '1rem 1.15rem' }}>
            <div className="note-sheet-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <h2 style={{ margin: 0 }}>
                  Notes
                  <span className="note-sheet-count">{rootNotes.length}</span>
                  {totalReplies > 0 && (
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-light)', fontWeight: 500, marginLeft: '0.4rem' }}>
                      ({totalReplies} {totalReplies === 1 ? 'reply' : 'replies'})
                    </span>
                  )}
                </h2>
                {rootNotes.length > 2 && (
                  <input
                    type="text"
                    placeholder="Search notes..."
                    value={noteSearch}
                    onChange={(e) => setNoteSearch(e.target.value)}
                    className="field-control"
                    style={{ padding: '0.2rem 0.55rem', fontSize: '0.76rem', width: 140 }}
                  />
                )}
              </div>
              <button type="button" onClick={() => { setConfirmDeptIds([]); setNewNoteTitle(''); setNoteModal(true); }} className="btn btn-secondary btn-sm">
                <PenLine size={14} /> Write Note
              </button>
            </div>

            <div className="note-sheet">
              {filteredRootNotes.length === 0 && (
                <p className="note-empty">{rootNotes.length === 0 ? <>No notes yet. Click <strong>Write Note</strong> to add one.</> : 'No notes match your search.'}</p>
              )}
              {filteredRootNotes.map((note, noteIdx) => {
                const noteReplies = note.replies || [];
                const parsed = parseNoteContent(note.content);
                return (
                  <div
                    key={note.id}
                    data-testid="note-card"
                    className="note-item"
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/files/${id}/notes/${note.id}`)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/files/${id}/notes/${note.id}`); } }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="note-item-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                        <span className="note-num-badge">Note #{noteIdx + 1}</span>
                        <div className="note-item-time">
                          <Clock size={12} /> {formatDate(note.createdAt)}
                        </div>
                        {note.author?.id === user?.id && (
                          !note.seenByHead ? (
                            <span className="note-seen-pill is-unseen">Unseen by Head</span>
                          ) : (
                            <span className="note-seen-pill is-seen">
                              <Check size={11} /> Seen by Head
                            </span>
                          )
                        )}
                      </div>

                      {canDeleteNote(note) && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDeleteNote(note); }}
                          className="btn btn-secondary btn-sm"
                          title="Delete note (unviewed by Head)"
                          style={{ color: 'var(--danger)', padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                        >
                          <Trash2 size={11} /> Delete
                        </button>
                      )}
                    </div>

                    <div className="note-item-author" style={{ marginTop: '0.35rem' }}>
                      {note.author?.name} <span>({roleText(note.author?.role)})</span>
                    </div>

                    {parsed.title && (
                      <div className="note-title-heading">
                        <FileText size={14} />
                        <span>{parsed.title}</span>
                      </div>
                    )}
                    <div className="note-item-body">{parsed.body}</div>

                    {(note.attachments || []).length > 0 && (
                      <div className="chip-group note-item-files" onClick={(e) => e.stopPropagation()}>
                        {note.attachments.map((att) => (
                          <AttachmentChip
                            key={att.id}
                            attachment={att}
                            canDelete={canDeleteAtt(att, note.author?.id)}
                            deleting={deletingAttId === att.id}
                            onSelect={() => {
                              const gi = incomingAttachments.findIndex((a) => a.id === att.id);
                              if (gi >= 0) setActiveAttIndex(gi);
                            }}
                            onDelete={handleDeleteAttachment}
                          />
                        ))}
                      </div>
                    )}

                    {noteReplies.length > 0 && (
                      <div style={{ marginTop: '0.45rem' }}>
                        <span className="note-reply-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--primary-deep)', fontWeight: 600 }}>
                          <MessageSquareReply size={13} /> {noteReplies.length} repl{noteReplies.length === 1 ? 'y' : 'ies'} · Click to view
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="surface-card" style={{ padding: '0.85rem', minWidth: 0 }}>
          <div style={{ marginBottom: '0.65rem' }}>
            <h2 style={{ fontSize: '0.9rem', fontWeight: 800, margin: 0 }}>Attachments ({incomingAttachments.length})</h2>
            {attachmentsLocked && incomingAttachments.length > 0 && (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', margin: '0.35rem 0 0' }}>
                Attachments are locked because a department head or CEO has already approved.
              </p>
            )}
            <div className="chip-group" style={{ marginTop: '0.45rem' }}>
              {incomingAttachments.length === 0 && <span style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>No documents attached yet.</span>}
              {incomingAttachments.map((att, idx) => (
                <AttachmentChip
                  key={att.id}
                  attachment={att}
                  active={activeAttIndex === idx}
                  canDelete={canDeleteAtt(att)}
                  deleting={deletingAttId === att.id}
                  onSelect={() => setActiveAttIndex(idx)}
                  onDelete={handleDeleteAttachment}
                />
              ))}
            </div>
          </div>

          <div className="preview-shell">
            <ErrorBoundary>
              <DocumentPreview
                attachment={activeAttachment}
                canDelete={canDeleteAtt(activeAttachment)}
                deleting={activeAttachment ? deletingAttId === activeAttachment.id : false}
                onDelete={handleDeleteAttachment}
              />
            </ErrorBoundary>
          </div>

          {(file.approvalMatrix || []).length > 0 && (
            <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
              <h2 style={{ fontSize: '0.9rem', fontWeight: 800, margin: 0 }}>Confirmation status ({file.approvalMatrix.length})</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
                {file.approvalMatrix.map((a) => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', padding: '0.55rem 0.8rem', borderRadius: 10, border: '1px solid var(--border-color)', background: a.status === 'APPROVED' ? 'var(--success-light)' : a.status === 'RETURNED' ? 'var(--danger-light)' : 'var(--bg-subtle)' }}>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                        {a.gate === 'CEO' ? 'CEO' : a.departmentName}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>
                        {a.reviewedBy ? `Signed by ${a.reviewedBy}${a.timestamp ? ` · ${formatDate(a.timestamp)}` : ''}` : 'Waiting'}
                        {a.comments ? ` · "${a.comments}"` : ''}
                      </div>
                    </div>
                    <StatusBadge status={a.status === 'PENDING' ? (a.gate === 'CEO' ? 'CEO_REVIEW' : 'DEPT_HEAD_REVIEW') : a.status === 'APPROVED' ? 'APPROVED' : 'RETURNED'} size="sm" />
                  </div>
                ))}
              </div>
            </div>
          )}
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
          Signing as <strong>{user?.name} ({user?.role})</strong>.
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
            <button type="submit" disabled={noteBusy || (!newNoteText.trim() && !newNoteTitle.trim() && newNoteAttachments.length === 0)} className="btn btn-primary" style={{ padding: '0.55rem 1.5rem', fontSize: '0.875rem' }}>
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
            <option key={o.id} value={o.id}>{o.name} ({o.role.replace(/_/g, ' ')} - {o.departmentName || o.deptId})</option>
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
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, Shield, Check, X, Paperclip, Send, Clock, Trash2, ChevronRight, RefreshCw, Loader2, PenLine, MessageSquareReply, UserCog, MoreHorizontal, FileText } from 'lucide-react';
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
import { getInitials, formatDate } from '../utils/format';
import { wrapLocalFiles, toUploadFiles, removePendingFile } from '../utils/pendingFiles';
import { areAttachmentsLocked, canDeleteAttachment, noteAuthorForAttachment } from '../utils/attachments';

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

function countNotes(notes = []) {
  return notes.reduce((n, note) => n + 1 + countNotes(note.replies || []), 0);
}

function ReplyList({ replies, incomingAttachments, setActiveAttIndex, onReply, canDeleteAttachmentFn, deletingAttId, onDeleteAttachment }) {
  if (!replies?.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginLeft: '1.4rem', paddingLeft: '1.1rem', borderLeft: '3px solid var(--border-accent)' }}>
      {replies.map((r) => (
        <div key={r.id} style={{ background: 'var(--bg-subtle)', borderRadius: 10, border: '1px solid var(--border-color)', padding: '0.8rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div className="avatar avatar-sm">{getInitials(r.author?.name)}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: '0.82rem' }}>{r.author?.name}</strong>
              <span className="badge badge-submitted" style={{ fontSize: '0.62rem' }}>REPLY</span>
            </div>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: 'auto' }}><Clock size={11} /> {formatDate(r.createdAt)}</span>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{r.content}</div>
          {(r.attachments || []).length > 0 && (
            <div className="chip-group">
              {r.attachments.map((att) => (
                <AttachmentChip
                  key={att.id}
                  attachment={att}
                  canDelete={Boolean(canDeleteAttachmentFn?.(att, r.author?.id))}
                  deleting={deletingAttId === att.id}
                  onSelect={() => {
                    const gi = incomingAttachments.findIndex((a) => a.id === att.id);
                    if (gi >= 0) setActiveAttIndex(gi);
                  }}
                  onDelete={onDeleteAttachment}
                />
              ))}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" onClick={(e) => { e.stopPropagation(); onReply(r); }} className="btn btn-secondary btn-sm">
              <MessageSquareReply size={13} /> Reply
            </button>
          </div>
          <ReplyList replies={r.replies} incomingAttachments={incomingAttachments} setActiveAttIndex={setActiveAttIndex} onReply={onReply} canDeleteAttachmentFn={canDeleteAttachmentFn} deletingAttId={deletingAttId} onDeleteAttachment={onDeleteAttachment} />
        </div>
      ))}
    </div>
  );
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
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteAttachments, setNewNoteAttachments] = useState([]);
  const [forwardRecipient, setForwardRecipient] = useState('');
  const [noteModal, setNoteModal] = useState(false);
  const [replyModal, setReplyModal] = useState(null);
  const [replyRecipient, setReplyRecipient] = useState('');
  const [replyText, setReplyText] = useState('');
  const [replyAttachments, setReplyAttachments] = useState([]);
  const [replyBusy, setReplyBusy] = useState(false);
  const [commentModal, setCommentModal] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);
  const [noteBusy, setNoteBusy] = useState(false);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [confirmDeptIds, setConfirmDeptIds] = useState([]);
  const [hoveredNote, setHoveredNote] = useState(null);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignId, setReassignId] = useState('');
  const [reassignBusy, setReassignBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState('');
  const [deletingAttId, setDeletingAttId] = useState('');

  const fileInputRef = useRef(null);
  const replyFileInputRef = useRef(null);
  const existingNoteFileRef = useRef(null);
  const attachTargetNoteRef = useRef(null);
  const [attachingNoteId, setAttachingNoteId] = useState('');

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
    api.meta.departments().then(({ departments: d }) => setDepartments(d || [])).catch(() => {});
  }, []);

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
  const rootNotes = useMemo(() => nestNoteTree(file?.notes || []), [file]);

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

  const handleAddExistingAttachments = async (note, fileList) => {
    const files = toUploadFiles(wrapLocalFiles(fileList));
    if (!note?.id || !files.length) return;
    setAttachingNoteId(note.id);
    try {
      await api.files.addNoteAttachments(id, note.id, files);
      toast('Files attached to the note', 'success');
      await load({ silent: true });
    } catch (err) {
      toast(err.message || 'Could not attach files', 'error');
    } finally {
      setAttachingNoteId('');
    }
  };

  const recipientValue = (o) => `${o.name} (${o.role.replace(/_/g, ' ')} - ${o.departmentName || o.deptId})`;

  const handleRemoveNewAtt = (attId) => {
    setNewNoteAttachments((prev) => removePendingFile(prev, attId));
  };

  const openReply = (note) => {
    const authorUser = users.find((u) => u.id === note.author?.id);
    const roleLabel = (note.author?.role || '').replace(/_/g, ' ');
    setReplyRecipient(authorUser ? recipientValue(authorUser) : (note.author?.name ? `${note.author.name} (${roleLabel})` : ''));
    setReplyText('');
    setReplyAttachments([]);
    setReplyModal(note);
  };

  const handleRemoveReplyAtt = (attId) => {
    setReplyAttachments((prev) => removePendingFile(prev, attId));
  };

  const handleReplySubmit = async (e) => {
    e.preventDefault();
    if (!replyModal) return;
    if (!replyText.trim() && replyAttachments.length === 0) return;
    setReplyBusy(true);
    try {
      await api.files.replyToNote(id, replyModal.id, {
        content: replyText.trim() || `${replyAttachments.length} file(s) attached`,
        sentTo: replyRecipient || 'Original Note Author',
        attachments: toUploadFiles(replyAttachments),
      });
      toast('Reply sent', 'success');
      setReplyModal(null);
      setReplyText('');
      setReplyRecipient('');
      setReplyAttachments([]);
      await load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setReplyBusy(false);
    }
  };

  const handleAddNoteSubmit = async (e) => {
    e.preventDefault();
    if (!newNoteText.trim() && newNoteAttachments.length === 0) return;
    setNoteBusy(true);
    try {
      await api.files.addNote(id, {
        content: newNoteText.trim() || `${newNoteAttachments.length} file(s) attached`,
        sentTo: forwardRecipient || '',
        confirmDeptIds,
        attachments: toUploadFiles(newNoteAttachments),
      });
      toast('Note minute added', 'success');
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
      toast('Archival PDF downloaded', 'success');
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
        <button className="btn btn-primary" onClick={() => navigate('/files')}>Back to Registry</button>
      </div>
    );
  }
  if (!file) return null;

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
      <input
        ref={existingNoteFileRef}
        type="file"
        multiple
        accept=".pdf,application/pdf,.docx,.xlsx,.csv,image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          handleAddExistingAttachments(attachTargetNoteRef.current, e.target.files);
          e.target.value = '';
        }}
      />
      <div className="glass-panel" style={{ padding: '1rem 1.4rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.1rem' }}>
          <button onClick={() => navigate('/files')} className="btn btn-secondary btn-sm">
            <ArrowLeft size={16} /> Back to Directory
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-light)', marginBottom: '0.2rem' }}>
              <span>Directory</span>
              <ChevronRight size={13} />
              <span>{file.creator?.departmentName}</span>
              <ChevronRight size={13} />
              <span className="ref-no">{file.refNo}</span>
            </div>
            <h1 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>{file.subject}</h1>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>Assigned Officer</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary-deep)' }}>{file.assignedOfficer?.name || 'Higher Authority'}</div>
          </div>
          <StatusBadge status={file.status} size="lg" />
          <button onClick={handleExport} className="btn btn-secondary btn-sm" disabled={!!exportBusy}>
            {exportBusy === 'archival' ? <Loader2 size={15} className="spin" /> : <Download size={15} />}
            Export Archival PDF
          </button>
          <button onClick={handleNotesExport} className="btn btn-secondary btn-sm" disabled={!!exportBusy}>
            {exportBusy === 'notes' ? <Loader2 size={15} className="spin" /> : <FileText size={15} />}
            Export Notes PDF
          </button>
          {canManageFile && (
            <div style={{ position: 'relative' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMenuOpen((o) => !o)} aria-label="File actions">
                <MoreHorizontal size={16} />
              </button>
              {menuOpen && (
                <div className="profile-menu" style={{ width: 210 }}>
                  <button type="button" className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => { setMenuOpen(false); setReassignId(file.assignedOfficer?.id || ''); setReassignOpen(true); }}>
                    <UserCog size={14} /> Reassign Officer
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--danger-red)' }} onClick={() => { setMenuOpen(false); setDeleteOpen(true); }}>
                    <Trash2 size={14} /> Delete File
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="file-detail-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          <div className="surface-card" style={{ padding: '1.25rem 1.4rem' }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: '0.85rem' }}>File Meta</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1rem', fontSize: '0.85rem' }}>
              <div><span style={{ color: 'var(--text-light)' }}>Raised by:</span> <strong>{file.creator?.name}</strong></div>
              <div><span style={{ color: 'var(--text-light)' }}>Created:</span> <strong>{formatDate(file.createdAt)}</strong></div>
            </div>
          </div>

          {(canApproveDept || canApproveCeo) && (
            <div className="signoff-banner">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Shield size={17} style={{ color: 'var(--success)' }} />
                  <strong style={{ fontSize: '0.9rem', color: 'var(--success-deep)' }}>Sign-Off Pending</strong>
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

          {canResubmit && (
            <button type="button" onClick={handleResubmit} className="btn btn-primary" style={{ alignSelf: 'flex-end' }}>
              <RefreshCw size={16} /> Resubmit File for Review
            </button>
          )}

          <div className="surface-card" style={{ padding: '1.25rem 1.4rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.85rem', marginBottom: '1rem', gap: '0.6rem', flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ fontSize: '0.98rem', fontWeight: 800, margin: 0 }}>Official Note Sheet Stream</h2>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-light)', margin: 0 }}>Versioned minute trail</p>
              </div>
              <span className="badge badge-submitted">{countNotes(rootNotes)} Minutes</span>
              <button type="button" onClick={() => { setConfirmDeptIds([]); setNoteModal(true); }} className="btn btn-primary btn-sm">
                <PenLine size={14} /> Write Note
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {rootNotes.length === 0 && <p style={{ fontSize: '0.82rem', color: 'var(--text-light)', textAlign: 'center', padding: '0.75rem 0' }}>No notes yet. Click <strong>Write Note</strong> to add your first minute.</p>}
              {rootNotes.map((note, idx) => {
                const isLatest = idx === rootNotes.length - 1;
                const noteAtts = note.attachments || [];
                const noteReplies = note.replies || [];
                return (
                  <div
                    key={note.id}
                    data-testid="note-card"
                    className={`note-card ${isLatest ? 'is-latest' : ''}`}
                    onClick={() => navigate(`/files/${id}/notes/${note.id}`)}
                    onMouseEnter={() => setHoveredNote(note.id)}
                    onMouseLeave={() => setHoveredNote(null)}
                    style={{ borderColor: hoveredNote === note.id ? 'var(--primary)' : undefined }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div className="avatar avatar-md">{getInitials(note.author?.name)}</div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <strong style={{ fontSize: '0.9rem' }}>{note.author?.name} <span style={{ fontWeight: 500, color: 'var(--text-light)' }}>({note.author?.role})</span></strong>
                            <span className="badge badge-submitted" style={{ fontSize: '0.68rem' }}>v{note.version}</span>
                          </div>
                          {note.sentTo && <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Sent To: <strong style={{ color: 'var(--primary-deep)' }}>{note.sentTo}</strong></div>}
                        </div>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Clock size={12} /> {formatDate(note.createdAt)}
                      </div>
                    </div>

                    <div style={{ fontSize: '0.86rem', color: 'var(--text-main)', lineHeight: 1.6, whiteSpace: 'pre-wrap', background: 'var(--bg-subtle)', padding: '0.75rem 1rem', borderRadius: 10 }}>{note.content}</div>

                    {noteAtts.length > 0 && (
                      <div className="chip-group" onClick={(e) => e.stopPropagation()}>
                        {noteAtts.map((att) => (
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

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '0.6rem' }}>
                      {noteReplies.length > 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginRight: 'auto' }}>{noteReplies.length} repl{noteReplies.length === 1 ? 'y' : 'ies'}</span>}
                      <button type="button" onClick={(e) => { e.stopPropagation(); navigate(`/files/${id}/notes/${note.id}`); }} className="btn btn-ghost btn-sm">
                        Open Thread <ChevronRight size={13} />
                      </button>
                      {canDeleteAtt({}, note.author?.id) && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={attachingNoteId === note.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            attachTargetNoteRef.current = note;
                            existingNoteFileRef.current?.click();
                          }}
                        >
                          {attachingNoteId === note.id ? <Loader2 size={13} className="spin" /> : <Paperclip size={13} />} Add files
                        </button>
                      )}
                      <button type="button" onClick={(e) => { e.stopPropagation(); openReply(note); }} className="btn btn-secondary btn-sm">
                        <MessageSquareReply size={13} /> Reply
                      </button>
                    </div>

                    {noteReplies.length > 0 && (
                      <ReplyList
                        replies={noteReplies}
                        incomingAttachments={incomingAttachments}
                        setActiveAttIndex={setActiveAttIndex}
                        onReply={openReply}
                        canDeleteAttachmentFn={canDeleteAtt}
                        deletingAttId={deletingAttId}
                        onDeleteAttachment={handleDeleteAttachment}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="surface-card" style={{ padding: '1.15rem', minHeight: 700 }}>
          <div style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.85rem' }}>
            <h2 style={{ fontSize: '0.98rem', fontWeight: 800, margin: 0 }}>Document Canvas ({incomingAttachments.length} files)</h2>
            {attachmentsLocked && incomingAttachments.length > 0 && (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', margin: '0.35rem 0 0' }}>
                Attachments are locked because a department head or CEO has already approved.
              </p>
            )}
            <div className="chip-group" style={{ marginTop: '0.75rem' }}>
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
            <h2 style={{ fontSize: '0.98rem', fontWeight: 800, margin: 0 }}>Confirmation status ({file.approvalMatrix.length})</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
              {file.approvalMatrix.map((a) => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', padding: '0.55rem 0.8rem', borderRadius: 10, border: '1px solid var(--border-color)', background: a.status === 'APPROVED' ? 'var(--success-light)' : a.status === 'RETURNED' ? 'var(--danger-light)' : 'var(--bg-subtle)' }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                      {a.gate === 'CEO' ? 'CEO Gate' : a.departmentName}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>
                      {a.reviewedBy ? `Signed by ${a.reviewedBy}${a.timestamp ? ` · ${formatDate(a.timestamp)}` : ''}` : 'Awaiting sign-off'}
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
        title={commentModal === 'RETURN' || commentModal === 'CEO_RETURN' ? 'Return Subject File' : 'Confirm Authorization & Sign'}
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
        <textarea rows={3} className="field-control" placeholder="Add optional comment or feedback..." value={commentText} onChange={(e) => setCommentText(e.target.value)} />
      </Modal>

      <Modal open={noteModal} onClose={() => { setNoteModal(false); setConfirmDeptIds([]); }} title="Write Note & Send" width={560}>
        <form onSubmit={handleAddNoteSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div>
            <label htmlFor="fwd-recipient" className="field-label">Send To (optional):</label>
            <select
              id="fwd-recipient"
              className="field-control"
              value={forwardRecipient}
              onChange={(e) => {
                const value = e.target.value;
                setForwardRecipient(value);
                const selected = users.find((u) => recipientValue(u) === value);
                if (selected?.deptId) {
                  setConfirmDeptIds((prev) => (prev.includes(selected.deptId) ? prev : [...prev, selected.deptId]));
                }
              }}
            >
              <option value="">— Select recipient —</option>
              {users.filter((u) => u.id !== user?.id).map((o) => (
                <option key={o.id} value={recipientValue(o)}>{recipientValue(o)}</option>
              ))}
            </select>
          </div>

          <div>
            <span className="field-label">Confirm with department</span>
            <div className="chip-group" role="group" aria-label="Confirmation departments">
              {departments.map((d) => {
                const active = confirmDeptIds.includes(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    data-dept-id={d.id}
                    className={`chip ${active ? 'is-active' : ''}`}
                    onClick={() => setConfirmDeptIds((prev) => (prev.includes(d.id) ? prev.filter((id) => id !== d.id) : [...prev, d.id]))}
                  >
                    {active ? '✓ ' : ''}{d.name}
                  </button>
                );
              })}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.35rem', display: 'block' }}>
              Pick the department that should confirm this note. That is when they appear for sign-off.
            </span>
          </div>

          <div>
            <label htmlFor="note-text" className="field-label">Minute Text:</label>
            <textarea id="note-text" className="field-control" rows={4} placeholder="Write your minute here…" value={newNoteText} onChange={(e) => setNewNoteText(e.target.value)} />
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
        open={!!replyModal}
        onClose={() => setReplyModal(null)}
        title={replyModal ? `Reply to ${replyModal.author?.name || 'Note'}` : 'Reply'}
        width={560}
      >
        <form onSubmit={handleReplySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div>
            <label htmlFor="reply-recipient" className="field-label">Reply To:</label>
            <select id="reply-recipient" className="field-control" value={replyRecipient} onChange={(e) => setReplyRecipient(e.target.value)}>
              {users.map((o) => (
                <option key={o.id} value={recipientValue(o)}>{recipientValue(o)}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="reply-text" className="field-label">Your Reply:</label>
            <textarea id="reply-text" className="field-control" rows={4} placeholder="Type your reply…" value={replyText} onChange={(e) => setReplyText(e.target.value)} />
          </div>

          {replyAttachments.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {replyAttachments.map((a) => (
                <div key={a.id} className="pending-file">
                  <span style={{ fontWeight: 600, color: 'var(--primary-deep)' }}>{a.name}</span>
                  <button type="button" onClick={() => handleRemoveReplyAtt(a.id)} aria-label={`Remove ${a.name}`} style={{ border: 'none', background: 'transparent', color: 'var(--danger)', cursor: 'pointer' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
            <input
              ref={replyFileInputRef}
              type="file"
              multiple
              accept=".pdf,application/pdf,.docx,.xlsx,.csv,image/*"
              onChange={(e) => {
                const wrapped = wrapLocalFiles(e.target.files);
                setReplyAttachments((prev) => [...prev, ...wrapped]);
                e.target.value = '';
              }}
              style={{ display: 'none' }}
            />
            <button type="button" onClick={() => replyFileInputRef.current?.click()} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
              <Paperclip size={14} /> Attach Documents
            </button>
            <button type="submit" disabled={replyBusy || (!replyText.trim() && replyAttachments.length === 0)} className="btn btn-primary" style={{ padding: '0.55rem 1.5rem', fontSize: '0.875rem' }}>
              {replyBusy ? <Loader2 size={15} className="spin" /> : <MessageSquareReply size={15} />} Send Reply
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
          This will permanently remove <strong>{file.refNo}</strong> and its notes, attachments, and approval history. This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}

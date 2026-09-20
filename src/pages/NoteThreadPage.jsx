import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, CornerDownRight, Loader2, MessageSquareReply, Paperclip, Send, X, FileText, Check, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { EVENT_NAMES } from '../lib/events';
import { connectSocket, getSocket } from '../lib/socket';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import Spinner from '../components/Spinner';
import AttachmentChip from '../components/AttachmentChip';
import DocumentPreview from '../components/DocumentPreview';
import ErrorBoundary from '../components/ErrorBoundary';
import { formatDate } from '../utils/format';
import { canDeleteAttachment } from '../utils/attachments';

const roleLabel = (role = '') => role.replace(/_/g, ' ');

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

export default function NoteThreadPage() {
  const { id, noteId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

  const [file, setFile] = useState(null);
  const [root, setRoot] = useState(null);
  const [thread, setThread] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [users, setUsers] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyRecipient, setReplyRecipient] = useState('');
  const [replyText, setReplyText] = useState('');
  const [replyAttachments, setReplyAttachments] = useState([]);
  const [busy, setBusy] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [deletingAttId, setDeletingAttId] = useState('');
  const [activeAttachment, setActiveAttachment] = useState(null);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const data = await api.files.getNoteThread(id, noteId);
      setFile(data.file);
      setRoot(data.note);
      setThread(data.thread || []);
    } catch (err) {
      if (!silent) setError(err.message || 'Failed to load thread');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [id, noteId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api.meta.users().then(({ users: u }) => setUsers(u || [])).catch(() => {});
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

  const childrenMap = useMemo(() => {
    const m = {};
    for (const t of thread) {
      const key = t.parentId || 'ROOT';
      (m[key] = m[key] || []).push(t);
    }
    return m;
  }, [thread]);

  const nameById = useMemo(() => Object.fromEntries(thread.map((t) => [t.id, t.author?.name || ''])), [thread]);

  const replyRecipients = useMemo(() => {
    return users
      .filter((u) => u.id !== user?.id)
      .filter((u) => {
        if (user?.role === 'STAFF') {
          return u.role === 'DEPT_HEAD';
        }
        return true;
      });
  }, [users, user?.role, user?.id]);

  const allThreadAttachments = useMemo(() => {
    const list = [];
    const seen = new Set();
    const add = (att, authorId) => {
      if (att && att.id && !seen.has(att.id)) {
        seen.add(att.id);
        list.push({ ...att, noteAuthorId: authorId || att.noteAuthorId });
      }
    };
    if (root?.attachments) {
      root.attachments.forEach((a) => add(a, root.author?.id));
    }
    for (const item of thread) {
      if (item.attachments) {
        item.attachments.forEach((a) => add(a, item.author?.id));
      }
    }
    if (file?.attachments) {
      file.attachments.forEach((a) => add(a, file.creator?.id));
    }
    return list;
  }, [root, thread, file]);

  useEffect(() => {
    if (!activeAttachment && allThreadAttachments.length > 0) {
      setActiveAttachment(allThreadAttachments[0]);
    } else if (activeAttachment && !allThreadAttachments.some((a) => a.id === activeAttachment.id)) {
      setActiveAttachment(allThreadAttachments[0] || null);
    }
  }, [allThreadAttachments, activeAttachment]);

  const openComposer = (node) => {
    setReplyingTo(node.id);
    setReplyRecipient(node.author?.name ? `${node.author.name} (${roleLabel(node.author.role)})` : '');
    setReplyText('');
    setReplyAttachments([]);
    setFileInputKey((k) => k + 1);
  };

  const closeComposer = () => {
    setReplyingTo(null);
    setReplyRecipient('');
    setReplyText('');
    setReplyAttachments([]);
    setBusy(false);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!replyingTo) return;
    if (!replyText.trim() && replyAttachments.length === 0) return;
    setBusy(true);
    try {
      const myDeptHead = users.find((u) => u.role === 'DEPT_HEAD' && u.deptId === user?.deptId);
      const effectiveSentTo = user?.role === 'STAFF'
        ? (myDeptHead ? `${myDeptHead.name} (${roleLabel(myDeptHead.role)})` : 'Department Head')
        : (replyRecipient || 'Original Note Author');
      await api.files.replyToNote(id, replyingTo, {
        content: replyText.trim() || `${replyAttachments.length} file(s) attached`,
        sentTo: effectiveSentTo,
        attachments: replyAttachments,
      });
      toast('Reply sent', 'success');
      closeComposer();
      await load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteAttachment = async (att) => {
    if (!att?.id) return;
    if (!window.confirm(`Remove “${att.filename}” from this note? Other attachments stay.`)) return;
    setDeletingAttId(att.id);
    try {
      await api.files.removeAttachment(id, att.id);
      toast('Attachment removed', 'success');
      if (activeAttachment?.id === att.id) {
        setActiveAttachment(null);
      }
      await load({ silent: true });
    } catch (err) {
      toast(err.message || 'Could not remove attachment', 'error');
    } finally {
      setDeletingAttId('');
    }
  };

  const addFiles = (e) => {
    const files = [...(e.target.files || [])];
    setReplyAttachments((prev) => [...prev, ...files].slice(0, 5));
  };

  const [deletingNoteId, setDeletingNoteId] = useState('');

  const canDeleteThisNote = (n) =>
    (user?.id === n.author?.id || user?.role === 'SUPERADMIN') &&
    !n.seenByHead &&
    (childrenMap[n.id] || []).length === 0;

  const handleDeleteNote = async (n) => {
    if (!n?.id) return;
    if (!window.confirm('Delete this note? This action cannot be undone.')) return;
    setDeletingNoteId(n.id);
    try {
      await api.files.deleteNote(id, n.id);
      toast('Note deleted', 'success');
      if (n.id === root?.id) {
        navigate(`/files/${id}`, { replace: true });
      } else {
        await load();
      }
    } catch (err) {
      toast(err.message || 'Could not delete note', 'error');
    } finally {
      setDeletingNoteId('');
    }
  };

  const renderNode = (node, depth) => {
    const childNodes = childrenMap[node.id] || [];
    const parsed = depth === 0 ? parseNoteContent(node.content) : { title: null, body: node.content };
    return (
      <div key={node.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <div
          data-testid={depth === 0 ? 'thread-root' : 'thread-reply'}
          className={`note-item ${depth > 0 ? 'is-reply' : ''}`}
        >
          <div className="note-item-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
              <span className={`note-num-badge ${depth > 0 ? 'reply-badge' : ''}`}>
                {depth === 0 ? 'Note #1' : 'Reply'}
              </span>
              <div className="note-item-time" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--text-light)' }}>
                <Clock size={11} /> {formatDate(node.createdAt)}
              </div>
              {node.author?.id === user?.id && (
                !node.seenByHead ? (
                  <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem', borderRadius: 4, background: '#fef3c7', color: '#b45309', fontWeight: 600 }}>
                    Unseen by Head
                  </span>
                ) : (
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-light)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                    <Check size={11} style={{ color: 'var(--success)' }} /> Seen by Head
                  </span>
                )
              )}
              {depth > 0 && node.parentId && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.74rem', color: 'var(--text-light)', marginLeft: '0.2rem' }}>
                  <CornerDownRight size={11} /> replying to {nameById[node.parentId] ? `@${nameById[node.parentId]}` : 'thread'}
                </span>
              )}
              {childNodes.length > 0 && (
                <span className="note-reply-tag" style={{ fontSize: '0.7rem', padding: '0.1rem 0.45rem' }}>
                  {childNodes.length} repl{childNodes.length === 1 ? 'y' : 'ies'}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              {canDeleteThisNote(node) && (
                <button
                  type="button"
                  onClick={() => handleDeleteNote(node)}
                  disabled={deletingNoteId === node.id}
                  className="btn btn-secondary btn-sm"
                  title="Delete this note (unviewed by Head)"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.2rem 0.5rem',
                    fontSize: '0.72rem',
                    height: 'auto',
                    lineHeight: 1.25,
                    borderRadius: 5,
                    color: 'var(--danger)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  <Trash2 size={11} /> Delete
                </button>
              )}

              <button
                type="button"
                onClick={() => openComposer(node)}
                className="btn btn-secondary btn-sm"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.2rem 0.55rem',
                  fontSize: '0.75rem',
                  height: 'auto',
                  lineHeight: 1.25,
                  borderRadius: 5,
                }}
              >
                <MessageSquareReply size={12} /> Reply
              </button>
            </div>
          </div>

          {parsed.title && (
            <div className="note-title-heading" style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)', margin: '0.2rem 0 0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <FileText size={14} style={{ color: 'var(--primary)' }} />
              <span>{parsed.title}</span>
            </div>
          )}

          <div className="note-item-body">{parsed.body}</div>

          {node.attachments?.length > 0 && (
            <div className="chip-group note-item-files" style={{ marginTop: '0.35rem' }}>
              {node.attachments.map((att) => (
                <AttachmentChip
                  key={att.id}
                  attachment={att}
                  active={activeAttachment?.id === att.id}
                  canDelete={canDeleteAttachment(user, file, att, node.author?.id)}
                  deleting={deletingAttId === att.id}
                  onSelect={(selected) => setActiveAttachment(selected)}
                  onDelete={handleDeleteAttachment}
                />
              ))}
            </div>
          )}
        </div>

        {replyingTo === node.id && (
          <form onSubmit={handleSend} style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-accent)', borderRadius: 8, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--primary-deep)' }}>
              Reply to Note
            </div>
            {user?.role !== 'STAFF' && (
              <select id="threadReply-recipient" value={replyRecipient} onChange={(e) => setReplyRecipient(e.target.value)} style={{ width: '100%', padding: '0.55rem', borderRadius: 6, border: '1px solid var(--border-strong)', fontSize: '0.85rem', outline: 'none', background: 'var(--bg-surface)' }}>
                <option value="">— Select recipient —</option>
                {replyRecipients.map((u) => (
                  <option key={u.id} value={`${u.name} (${roleLabel(u.role)})`}>{u.name} ({roleLabel(u.role)} - {u.departmentName || u.deptId})</option>
                ))}
              </select>
            )}
            <textarea id="threadReply-text" value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={3} placeholder="Reply" style={{ width: '100%', padding: '0.6rem', borderRadius: 6, border: '1px solid var(--border-strong)', fontSize: '0.85rem', outline: 'none', resize: 'vertical', fontFamily: 'inherit', background: 'var(--bg-surface)' }} />
            <input id="threadReply-file" key={fileInputKey} type="file" multiple onChange={addFiles} style={{ fontSize: '0.78rem' }} />
            {replyAttachments.length > 0 && (
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {replyAttachments.map((f, i) => (
                  <span key={i} style={{ fontSize: '0.7rem', padding: '0.2rem 0.6rem', borderRadius: 20, border: '1px solid var(--border-strong)', background: 'var(--bg-surface)', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Paperclip size={11} /> {f.name}
                    <button type="button" onClick={() => setReplyAttachments((prev) => prev.filter((_, idx) => idx !== i))} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-light)' }}><X size={11} /></button>
                  </span>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" onClick={closeComposer} className="btn btn-secondary btn-sm">Cancel</button>
              <button type="submit" disabled={busy || (!replyText.trim() && replyAttachments.length === 0)} className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 1rem' }}>
                {busy ? <Loader2 size={13} className="spin" /> : <Send size={13} />} Send Reply
              </button>
            </div>
          </form>
        )}

        {childNodes.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.2rem' }}>
            {childNodes.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) return <Spinner label="Loading noting sheet..." />;

  return (
    <div className="page page-wide" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <button onClick={() => navigate(`/files/${id}`)} className="btn btn-secondary btn-sm">
          <ArrowLeft size={14} /> Back to File
        </button>
        {file && (
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Official Noting Sheet · <strong style={{ color: 'var(--text-main)' }}>{file.refNo}</strong>
          </span>
        )}
      </div>

      {error && (
        <div role="alert" className="alert alert-error">
          {error} — <a href={`/files/${id}`}>go back to the file</a>
        </div>
      )}

      {file && root && (
        <div className="file-detail-grid">
          {/* Left: Official Noting Sheet */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div className="glass-panel" style={{ padding: '1rem 1.25rem' }}>
              <div className="crumb">Official Noting Sheet</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, marginTop: '0.2rem' }}>{file.refNo} · {file.subject}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                {thread.length} minute{thread.length === 1 ? '' : 's'} recorded
                {allThreadAttachments.length > 0 && ` · ${allThreadAttachments.length} attachment${allThreadAttachments.length === 1 ? '' : 's'}`}
              </div>
            </div>

            <div className="surface-card" style={{ padding: '0.85rem' }}>
              <div className="note-sheet" style={{ maxHeight: '640px' }}>
                {renderNode(root, 0)}
              </div>
            </div>
          </div>

          {/* Right: Document / PDF view */}
          <div className="surface-card" style={{ padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '0.92rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Paperclip size={15} style={{ color: 'var(--primary)' }} />
                  <span>Attached Documents {allThreadAttachments.length > 0 ? `(${allThreadAttachments.length})` : ''}</span>
                </h2>
                {activeAttachment && (
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }} title={activeAttachment.filename}>
                    Viewing: <strong style={{ color: 'var(--text-main)' }}>{activeAttachment.filename}</strong>
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', margin: '0.2rem 0 0.5rem' }}>
                Click any attached file in the note sheet or from the list below to preview it.
              </p>

              <div className="chip-group" style={{ marginBottom: '0.65rem' }}>
                {allThreadAttachments.length === 0 && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>
                    No documents attached yet. Attach a file when replying or creating notes.
                  </span>
                )}
                {allThreadAttachments.map((att) => (
                  <AttachmentChip
                    key={att.id}
                    attachment={att}
                    active={activeAttachment?.id === att.id}
                    canDelete={canDeleteAttachment(user, file, att, att.noteAuthorId || root?.author?.id)}
                    deleting={deletingAttId === att.id}
                    onSelect={(selected) => setActiveAttachment(selected)}
                    onDelete={handleDeleteAttachment}
                  />
                ))}
              </div>
            </div>

            <div className="preview-shell" style={{ height: 'min(75vh, 720px)' }}>
              <ErrorBoundary>
                <DocumentPreview
                  attachment={activeAttachment}
                  canDelete={canDeleteAttachment(user, file, activeAttachment, activeAttachment?.noteAuthorId || root?.author?.id)}
                  deleting={activeAttachment ? deletingAttId === activeAttachment.id : false}
                  onDelete={handleDeleteAttachment}
                />
              </ErrorBoundary>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
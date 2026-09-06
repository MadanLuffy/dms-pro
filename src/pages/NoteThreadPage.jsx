import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, CornerDownRight, Loader2, MessageSquareReply, Paperclip, Send, X } from 'lucide-react';
import { api } from '../lib/api';
import { EVENT_NAMES } from '../lib/events';
import { connectSocket, getSocket } from '../lib/socket';
import { useToast } from '../components/Toast';
import Spinner from '../components/Spinner';
import { getInitials, formatDate } from '../utils/format';

const roleLabel = (role = '') => role.replace(/_/g, ' ');

export default function NoteThreadPage() {
  const { id, noteId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

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
    return () => {
      socket.off(EVENT_NAMES.NOTE_ADDED, reload);
      socket.off(EVENT_NAMES.NOTE_REPLY, reload);
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
      await api.files.replyToNote(id, replyingTo, {
        content: replyText.trim() || `${replyAttachments.length} file(s) attached`,
        sentTo: replyRecipient || 'Original Note Author',
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

  const addFiles = (e) => {
    const files = [...(e.target.files || [])];
    setReplyAttachments((prev) => [...prev, ...files].slice(0, 5));
  };

  const renderNode = (node, depth) => {
    const childNodes = childrenMap[node.id] || [];
    return (
      <div key={node.id}>
        <div
          data-testid={depth === 0 ? 'thread-root' : 'thread-reply'}
          style={{ background: depth === 0 ? 'var(--bg-surface)' : 'var(--bg-subtle)', borderRadius: 12, border: `1px solid ${depth === 0 ? 'var(--border-accent)' : 'var(--border-color)'}`, boxShadow: depth === 0 ? 'var(--shadow-sm)' : 'none', padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
              <div style={{ width: depth === 0 ? 36 : 30, height: depth === 0 ? 36 : 30, borderRadius: '50%', background: depth === 0 ? 'linear-gradient(135deg,#2563eb,#1d4ed8)' : 'var(--bg-inset)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.78rem', flexShrink: 0 }}>
                {getInitials(node.author?.name)}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: '0.9rem' }}>{node.author?.name}</strong>
                  {depth === 0 ? (
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--primary-deep)', background: 'var(--primary-light)', padding: '0.1rem 0.4rem', borderRadius: 4 }}>v{node.version}</span>
                  ) : (
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--primary-deep)', background: 'var(--primary-light)', padding: '0.1rem 0.4rem', borderRadius: 4 }}>REPLY</span>
                  )}
                  {depth > 0 && node.parentId && (
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-light)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <CornerDownRight size={11} /> replying to {nameById[node.parentId] ? `@${nameById[node.parentId]}` : 'thread'}
                    </span>
                  )}
                </div>
                {node.sentTo && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Sent To: <strong style={{ color: 'var(--primary-deep)' }}>{node.sentTo}</strong></div>}
              </div>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
              <Clock size={11} /> {formatDate(node.createdAt)}
            </div>
          </div>

          <div style={{ fontSize: '0.86rem', color: 'var(--text-main)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{node.content}</div>

          {node.attachments?.length > 0 && (
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {node.attachments.map((att) => (
                <span key={att.id} style={{ fontSize: '0.7rem', padding: '0.22rem 0.6rem', borderRadius: 20, border: '1px solid var(--border-strong)', background: 'var(--bg-surface)', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Paperclip size={11} /> {att.filename}
                </span>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '0.6rem' }}>
            {childNodes.length > 0 && (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-light)', marginRight: 'auto' }}>{childNodes.length} repl{childNodes.length === 1 ? 'y' : 'ies'}</span>
            )}
            <button type="button" onClick={() => openComposer(node)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.76rem', fontWeight: 700, color: 'var(--primary)', background: 'var(--primary-light)', border: '1px solid var(--border-accent)', cursor: 'pointer', padding: '0.28rem 0.7rem', borderRadius: 16 }}>
              <MessageSquareReply size={13} /> Reply
            </button>
          </div>
        </div>

        {replyingTo === node.id && (
          <form onSubmit={handleSend} style={{ marginTop: '0.7rem', marginLeft: depth === 0 ? '1.6rem' : '1.2rem', paddingLeft: depth === 0 ? '1.2rem' : '0.9rem', background: 'var(--primary-light)', border: '1px solid var(--border-accent)', borderRadius: 12, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--primary-deep)' }}>Reply to {node.author?.name || 'this message'}</div>
            <select id="threadReply-recipient" value={replyRecipient} onChange={(e) => setReplyRecipient(e.target.value)} style={{ width: '100%', padding: '0.55rem', borderRadius: 8, border: '1px solid var(--border-strong)', fontSize: '0.85rem', outline: 'none', background: 'var(--bg-surface)' }}>
              <option value="">— Select recipient —</option>
              {users.map((u) => (
                <option key={u.id} value={`${u.name} (${roleLabel(u.role)})`}>{u.name} ({roleLabel(u.role)} - {u.departmentName || u.deptId})</option>
              ))}
            </select>
            <textarea id="threadReply-text" value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={3} placeholder="Type your reply..." style={{ width: '100%', padding: '0.6rem', borderRadius: 8, border: '1px solid var(--border-strong)', fontSize: '0.85rem', outline: 'none', resize: 'vertical', fontFamily: 'inherit', background: 'var(--bg-surface)' }} />
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', marginLeft: depth === 0 ? '1.6rem' : '1.2rem', paddingLeft: depth === 0 ? '1.2rem' : '0.9rem', borderLeft: depth === 0 ? '3px solid var(--border-accent)' : '2px solid var(--border-color)', marginTop: '0.7rem' }}>
            {childNodes.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) return <Spinner label="Loading thread..." />;

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <button onClick={() => navigate(`/files/${id}`)} className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
        <ArrowLeft size={14} /> Back to File
      </button>

      {error && (
        <div style={{ background: 'var(--danger-light)', border: '1px solid var(--danger)', color: 'var(--danger-deep)', padding: '1rem', borderRadius: 10, fontSize: '0.85rem' }}>
          {error} — <a href={`/files/${id}`} style={{ color: 'var(--primary-deep)' }}>go back to the file</a>
        </div>
      )}

      {file && root && (
        <>
          <div style={{ background: 'linear-gradient(135deg,#1e3a8a,#2563eb)', borderRadius: 16, padding: '1.25rem 1.5rem', color: '#ffffff' }}>
            <div style={{ opacity: 0.85, fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Note Thread</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: '0.2rem' }}>{file.refNo} · {file.subject}</div>
            <div style={{ fontSize: '0.8rem', opacity: 0.85, marginTop: '0.25rem' }}>{thread.length} message{thread.length === 1 ? '' : 's'} · started by {root.author?.name}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            {renderNode(root, 0)}
          </div>
        </>
      )}
    </div>
  );
}
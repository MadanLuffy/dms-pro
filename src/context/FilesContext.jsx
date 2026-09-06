import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { connectSocket, getSocket } from '../lib/socket';
import { EVENT_NAMES } from '../lib/events';
import { useAuth } from './AuthContext';
import { useToast } from '../components/Toast';

const FilesContext = createContext(null);

export function FilesProvider({ children }) {
  const { user } = useAuth();
  const toast = useToast();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({ page: 1, pageSize: 50, total: 0 });
  const loadSeq = useRef(0);
  const lastParams = useRef({ page: 1, pageSize: 50 });

  const loadFiles = useCallback(async (params = {}, opts = {}) => {
    const seq = ++loadSeq.current;
    const merged = { ...lastParams.current, ...params };
    lastParams.current = merged;
    if (!opts.silent) {
      setLoading(true);
      setError('');
    }
    try {
      const data = await api.files.list(merged);
      const list = data.files || [];
      if (seq === loadSeq.current) {
        setFiles(list);
        setPagination({
          page: data.page || merged.page || 1,
          pageSize: data.pageSize || merged.pageSize || 50,
          total: data.total ?? list.length,
        });
      }
      return list;
    } catch (err) {
      if (seq === loadSeq.current) setError(err.message);
      return [];
    } finally {
      if (seq === loadSeq.current && !opts.silent) setLoading(false);
    }
  }, []);

  const refreshFile = useCallback(async (id) => {
    try {
      const { file } = await api.files.get(id);
      setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...file } : f)));
      return file;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (user && user.role !== 'SUPERADMIN') loadFiles();
  }, [user, loadFiles]);

  useEffect(() => {
    if (!user || user.role === 'SUPERADMIN') return;
    const socket = getSocket() || connectSocket();
    if (!socket) return;

    const handle = (eventName) => () => {
      toast(`Live update: ${eventName.replaceAll(':', ' ')}`, 'notification');
      loadFiles({}, { silent: true });
    };

    const handlers = [
      EVENT_NAMES.FILE_CREATED,
      EVENT_NAMES.FILE_FORWARDED,
      EVENT_NAMES.FILE_APPROVED,
      EVENT_NAMES.FILE_DELETED,
      EVENT_NAMES.FILE_RETURNED,
      EVENT_NAMES.NOTE_ADDED,
      EVENT_NAMES.NOTE_REPLY,
      EVENT_NAMES.ATTACHMENT_REMOVED,
      EVENT_NAMES.APPROVAL_GRANTED,
      EVENT_NAMES.APPROVAL_READY,
      EVENT_NAMES.APPROVAL_RETURNED,
    ].map((name) => {
      const fn = handle(name);
      socket.on(name, fn);
      return { name, fn };
    });

    return () => {
      for (const { name, fn } of handlers) socket.off(name, fn);
    };
  }, [user, toast, loadFiles]);

  return (
    <FilesContext.Provider value={{ files, loading, error, pagination, loadFiles, refreshFile, setFiles }}>
      {children}
    </FilesContext.Provider>
  );
}

export function useFiles() {
  return useContext(FilesContext);
}

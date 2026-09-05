import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { CheckCircle2, BellRing, Info, AlertTriangle } from 'lucide-react';

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message, type = 'info', { timeout = 4500 } = {}) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => remove(id), timeout);
    },
    [remove]
  );

  const toast = useCallback(
    (message, type, opts) => {
      push(message, type, opts);
    },
    [push]
  );

  const ICONS = {
    success: <CheckCircle2 size={18} color="#16a34a" />,
    notification: <BellRing size={18} color="#2563eb" />,
    info: <Info size={18} color="#2563eb" />,
    error: <AlertTriangle size={18} color="#dc2626" />,
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        aria-live="polite"
        role="status"
        style={{
          position: 'fixed',
          top: 68,
          right: 16,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          maxWidth: 360,
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            onClick={() => remove(t.id)}
            role="button"
            style={{
              background: 'rgba(255,255,255,0.92)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(148,163,184,0.35)',
              borderRadius: 12,
              boxShadow: '0 12px 28px rgba(15,23,42,0.12)',
              padding: '10px 12px',
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              fontSize: 14,
              color: '#0f172a',
              cursor: 'pointer',
            }}
          >
            <span style={{ marginTop: 1 }}>{ICONS[t.type] || ICONS.info}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
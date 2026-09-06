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
    success: <CheckCircle2 size={17} color="var(--success)" />,
    notification: <BellRing size={17} color="var(--primary)" />,
    info: <Info size={17} color="var(--primary)" />,
    error: <AlertTriangle size={17} color="var(--danger)" />,
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        aria-live="polite"
        role="status"
        style={{
          position: 'fixed',
          top: 64,
          right: 16,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          maxWidth: 340,
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="dms-toast"
            onClick={() => remove(t.id)}
            role="button"
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
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, children, footer, width = 520 }) {
  const overlayRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      ref={overlayRef}
      onMouseDown={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Dialog'}
    >
      <div className="modal-content" style={{ maxWidth: width, padding: '0 0 1.25rem 0', overflowY: 'auto' }}>
        {title && (
          <div style={{ padding: '0.85rem 1.4rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>{title}</h3>
            <button type="button" onClick={onClose} aria-label="Close dialog" className="btn btn-ghost btn-sm" style={{ padding: 3 }}>
              <X size={18} />
            </button>
          </div>
        )}
        <div style={{ padding: '1.1rem 1.4rem' }}>{children}</div>
        {footer && <div style={{ padding: '0 1.4rem' }}>{footer}</div>}
      </div>
    </div>
  );
}

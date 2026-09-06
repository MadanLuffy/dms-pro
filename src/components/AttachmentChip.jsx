import { Paperclip, X, Loader2 } from 'lucide-react';

export default function AttachmentChip({
  attachment,
  active = false,
  canDelete = false,
  deleting = false,
  onSelect,
  onDelete,
}) {
  return (
    <div className={`chip ${active ? 'is-active' : ''}`}>
      <button
        type="button"
        className="chip-label"
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.(attachment);
        }}
        title={attachment.filename}
      >
        <Paperclip size={12} />
        <span>{attachment.filename}</span>
      </button>
      {canDelete && (
        <button
          type="button"
          className="chip-remove"
          disabled={deleting}
          aria-label={`Remove ${attachment.filename}`}
          title="Remove this attachment"
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.(attachment);
          }}
        >
          {deleting ? <Loader2 size={11} className="spin" /> : <X size={12} />}
        </button>
      )}
    </div>
  );
}

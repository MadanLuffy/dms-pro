export default function EmptyState({ title, hint, icon: Icon }) {
  return (
    <div className="empty-state">
      {Icon ? <Icon size={28} className="empty-state-icon" /> : null}
      <div className="empty-state-title">{title}</div>
      {hint ? <p className="empty-state-hint">{hint}</p> : null}
    </div>
  );
}

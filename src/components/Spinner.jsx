export default function Spinner({ label = 'Loading...' }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '3rem 1rem',
        color: 'var(--text-light)',
        fontSize: 14,
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          border: '3px solid var(--border-accent)',
          borderTopColor: 'var(--primary)',
          borderRadius: '50%',
          animation: 'dms-spin 0.8s linear infinite',
        }}
      />
      {label}
    </div>
  );
}
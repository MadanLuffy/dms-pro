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
        color: '#64748b',
        fontSize: 14,
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          border: '3px solid #dbeafe',
          borderTopColor: '#2563eb',
          borderRadius: '50%',
          animation: 'dms-spin 0.8s linear infinite',
        }}
      />
      {label}
    </div>
  );
}
export default function Footer() {
  return (
    <footer
      style={{
        borderTop: '1px solid var(--border-color)',
        padding: '1.25rem 2rem',
        background: 'var(--bg-glass)',
        fontSize: '0.8rem',
        color: 'var(--text-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
        marginTop: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <strong style={{ color: 'var(--text-main)', fontWeight: 700 }}>DMS Pro</strong>
        <span>·</span>
        <span>Enterprise Document Management & Workflow System</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem' }}>
        <span>Version 2.4</span>
        <span>·</span>
        <span>Secure 256-Bit SSL</span>
        <span>·</span>
        <span>© {new Date().getFullYear()} DMS Pro. All rights reserved.</span>
      </div>
    </footer>
  );
}

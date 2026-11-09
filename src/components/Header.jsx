import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FileText, Plus, Search, Shield, LogOut, ChevronDown, Settings, PhoneCall, Calendar, Clock, Building, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getInitials, roleLabel } from '../utils/format';
import { homePath, isAdmin } from '../utils/home';
import ThemeToggle from './ThemeToggle';

export default function Header({ onOpenNewFile, searchQuery, setSearchQuery }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [fontSize, setFontSize] = useState(100);
  const [timeStr, setTimeStr] = useState(() =>
    new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  );
  const menuRef = useRef(null);
  const adminUser = isAdmin(user);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeStr(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  if (!user) return null;

  const onFiles = location.pathname === '/files' || location.pathname.startsWith('/files/');
  const onAudit = location.pathname.startsWith('/audit');
  const onAdmin = location.pathname.startsWith('/admin');
  const onCreate = location.pathname === '/files/new';
  const canViewAudit = user.role === 'SUPERADMIN' || user.role === 'CEO';

  const handleSearch = (value) => {
    setSearchQuery(value);
    if (location.pathname !== '/files') navigate('/files');
  };

  const handleFontSize = (delta) => {
    setFontSize((prev) => {
      const next = delta === 0 ? 100 : Math.min(125, Math.max(85, prev + delta));
      document.documentElement.style.fontSize = next === 100 ? '' : `${(next / 100) * 16}px`;
      return next;
    });
  };

  const todayStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <header className="app-header" style={{ position: 'sticky', top: 0, zIndex: 1000 }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0.6rem 1.4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        {/* Left: Brand Logo & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <button
            type="button"
            className="brand"
            onClick={() => navigate(homePath(user))}
            style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
          >
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              background: 'linear-gradient(135deg, #1d4ed8 0%, #0b4f8a 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(29, 78, 216, 0.25)'
            }}>
              <FileText size={20} />
            </div>
            <div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
                DMS <span style={{ color: '#2563eb' }}>Pro</span>
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-light)', fontWeight: 600 }}>
                Enterprise Document System
              </div>
            </div>
          </button>

          {/* Navigation Links */}
          <nav aria-label="Primary" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            {adminUser ? (
              <button
                type="button"
                onClick={() => navigate('/admin')}
                className={`btn ${onAdmin ? 'btn-primary' : 'btn-ghost'} btn-sm`}
                style={{ fontWeight: 600 }}
              >
                <Settings size={15} /> Administration
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => navigate('/files')}
                  className={`btn ${onFiles && !onCreate ? 'btn-primary' : 'btn-ghost'} btn-sm`}
                  style={{ fontWeight: 600 }}
                >
                  <FileText size={15} /> File Registry
                </button>
                <button
                  type="button"
                  onClick={onOpenNewFile}
                  className={`btn ${onCreate ? 'btn-primary' : 'btn-ghost'} btn-sm`}
                  style={{ fontWeight: 600, color: '#16a34a' }}
                >
                  <Plus size={15} /> Create New File
                </button>
              </>
            )}
            {canViewAudit && (
              <button
                type="button"
                onClick={() => navigate('/audit')}
                className={`btn ${onAudit ? 'btn-primary' : 'btn-ghost'} btn-sm`}
                style={{ fontWeight: 600 }}
              >
                <Shield size={15} /> Audit Log
              </button>
            )}
          </nav>
        </div>

        {/* Center: Search (if not admin) */}
        {!adminUser && (
          <div style={{ position: 'relative', width: 260, maxWidth: '100%', flex: '0 1 260px' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
            <input
              type="search"
              aria-label="Search files by reference number or subject"
              placeholder="Search files (Ref / Subject)..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '0.38rem 0.65rem 0.38rem 2rem',
                fontSize: '0.8rem',
                borderRadius: 8,
                border: '1px solid var(--border-color)',
                background: 'var(--bg-subtle)',
                color: 'var(--text-main)',
                outline: 'none'
              }}
            />
          </div>
        )}

        {/* Right: Clock, Theme, Profile, Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-light)', display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 600 }}>
            <Clock size={13} /> {timeStr}
          </span>
          <ThemeToggle />

          {/* Profile Dropdown */}
          <div className="profile-wrap" ref={menuRef}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0.55rem' }}
            >
              <span className="avatar avatar-sm" style={{ background: '#2563eb', color: '#ffffff', fontWeight: 800 }}>
                {getInitials(user.name)}
              </span>
              <span style={{ textAlign: 'left', lineHeight: 1.2 }}>
                <strong style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-main)' }}>{user.name}</strong>
                <span style={{ fontSize: '0.66rem', color: 'var(--text-light)' }}>{roleLabel(user.role)}</span>
              </span>
              <ChevronDown size={13} style={{ color: 'var(--text-light)' }} />
            </button>
            {menuOpen && (
              <div className="profile-menu" role="menu">
                <div style={{ padding: '0.5rem 0.75rem' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.875rem' }}>{user.name}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>{user.email}</div>
                  <div style={{ marginTop: 6, fontSize: '0.7rem', fontWeight: 700, color: '#2563eb' }}>
                    {roleLabel(user.role)}
                  </div>
                  <span className="badge badge-submitted" style={{ marginTop: 6, display: 'inline-block' }}>
                    {user.departmentName || user.deptId}
                  </span>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => { logout(); navigate('/login'); }}
            className="btn btn-secondary btn-sm"
            title="Log out"
            style={{ fontWeight: 600 }}
          >
            <LogOut size={14} /> Log out
          </button>
        </div>
      </div>
    </header>
  );
}

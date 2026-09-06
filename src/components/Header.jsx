import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FileText, Plus, Search, Shield, Folder, LogOut, ChevronDown, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getInitials } from '../utils/format';
import { homePath, isAdmin } from '../utils/home';
import ThemeToggle from './ThemeToggle';

export default function Header({ onOpenNewFile, searchQuery, setSearchQuery }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const adminUser = isAdmin(user);

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

  return (
    <header className="app-header glass-header">
      <div className="header-inner">
        <div className="header-top">
          <button type="button" className="brand" onClick={() => navigate(homePath(user))}>
            <span className="brand-mark"><Folder size={18} /></span>
            <span>
              <div style={{ fontSize: '1rem', fontWeight: 800, lineHeight: 1.2, fontFamily: 'var(--font-heading)', letterSpacing: '-0.015em' }}>
                Document Management
              </div>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>
                {user.departmentName || user.deptId}
              </p>
            </span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <ThemeToggle />
            <div className="profile-wrap" ref={menuRef}>
              <button type="button" className="profile-trigger" onClick={() => setMenuOpen((o) => !o)} aria-haspopup="menu" aria-expanded={menuOpen}>
                <span className="avatar avatar-md">{getInitials(user.name)}</span>
                <span style={{ textAlign: 'left' }}>
                  <strong style={{ display: 'block', fontSize: '0.8rem' }}>{user.name}</strong>
                  <span style={{ fontSize: '0.67rem', color: 'var(--text-light)' }}>{user.role.replace(/_/g, ' ')}</span>
                </span>
                <ChevronDown size={13} />
              </button>
              {menuOpen && (
                <div className="profile-menu" role="menu">
                  <div style={{ padding: '0.35rem 0.4rem 0.35rem' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>{user.name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>{user.email}</div>
                    <span className="badge badge-submitted" style={{ marginTop: 8 }}>{user.departmentName || user.deptId}</span>
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => { logout(); navigate('/login'); }}
              className="btn btn-secondary btn-sm"
              title="Log out"
            >
              <LogOut size={15} /> Logout
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.85rem' }}>
          <nav aria-label="Primary" className="header-nav">
            {adminUser ? (
              <button type="button" onClick={() => navigate('/admin')} className={`btn nav-pill ${onAdmin ? 'btn-primary is-active' : 'btn-secondary'}`}>
                <Settings size={16} /> Administration
              </button>
            ) : (
              <>
                <button type="button" onClick={() => navigate('/files')} className={`btn nav-pill ${onFiles && !onCreate ? 'btn-primary is-active' : 'btn-secondary'}`}>
                  <FileText size={16} /> File Registry
                </button>
                <button type="button" onClick={onOpenNewFile} className={`btn nav-pill ${onCreate ? 'btn-success is-active' : 'btn-success'}`}>
                  <Plus size={16} /> Create New File
                </button>
              </>
            )}
            {canViewAudit && (
              <button type="button" onClick={() => navigate('/audit')} className={`btn nav-pill ${onAudit ? 'btn-primary is-active' : 'btn-secondary'}`}>
                <Shield size={16} /> Audit
              </button>
            )}
          </nav>

          {!adminUser && (
            <div className="search-field">
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
              <input
                type="search"
                aria-label="Search files by reference number or subject"
                placeholder="Search files"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

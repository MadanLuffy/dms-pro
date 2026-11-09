import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, KeyRound, ArrowRight, Eye, EyeOff, FileText, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { homePath } from '../utils/home';
import ThemeToggle from '../components/ThemeToggle';

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (user) navigate(homePath(user), { replace: true });
  }, [user, navigate]);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const loggedIn = await login(email.trim(), password);
      navigate(homePath(loggedIn), { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  const fillQuickCreds = (em, pass = 'Password@123') => {
    setEmail(em);
    setPassword(pass);
    setError('');
  };

  return (
    <div className="login-screen" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: 0, background: 'var(--bg-app)' }}>
      {/* Top Professional Nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 2rem', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(37,99,235,0.3)' }}>
            <FileText size={18} />
          </div>
          <strong style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            DMS <span style={{ color: '#2563eb' }}>Pro</span>
          </strong>
        </div>
        <ThemeToggle />
      </div>

      {/* Center Professional Login Content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem 1rem' }}>
        <div className="login-card" style={{ maxWidth: 440, width: '100%', borderRadius: 16, border: '1px solid var(--border-color)', boxShadow: '0 12px 32px rgba(0, 0, 0, 0.08)' }}>
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem', marginBottom: '0.5rem' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--primary-subtle)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.2rem' }}>
              <FileText size={26} />
            </div>

            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', margin: '0.1rem 0 0', letterSpacing: '-0.01em' }}>
              e-Office Document System
            </h1>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-light)', margin: 0, fontWeight: 500 }}>
              Sign in to manage and approve enterprise files
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.75rem' }}>
            {error && <div role="alert" className="alert alert-error">{error}</div>}

            <div>
              <label htmlFor="login-email" className="field-label" style={{ fontWeight: 600, fontSize: '0.8rem' }}>
                Email Address *
              </label>
              <div className="field-wrap">
                <Mail size={16} className="field-icon" style={{ color: 'var(--text-light)' }} />
                <input
                  id="login-email"
                  className="field-control"
                  type="email"
                  required
                  autoComplete="username"
                  placeholder="name@organization.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ fontWeight: 500 }}
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="field-label" style={{ fontWeight: 600, fontSize: '0.8rem' }}>
                Password *
              </label>
              <div className="field-wrap">
                <KeyRound size={16} className="field-icon" style={{ color: 'var(--text-light)' }} />
                <input
                  id="login-password"
                  className="field-control"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingRight: '2.4rem' }}
                />
                <button
                  type="button"
                  className="field-eye"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="btn btn-primary btn-lg"
              style={{ marginTop: '0.2rem', width: '100%', fontSize: '0.9rem', fontWeight: 700 }}
            >
              <ArrowRight size={17} />
              {busy ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Quick Demo Role Selection Tray */}
          <div className="gov-role-selector" style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
            <span className="gov-role-label" style={{ fontSize: '0.72rem', color: 'var(--text-light)', fontWeight: 600 }}>
              ⚡ Quick Test Logins:
            </span>
            <div className="gov-role-chips" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem', marginTop: '0.45rem' }}>
              <button
                type="button"
                className="gov-role-chip"
                onClick={() => fillQuickCreds('ceo@skandasoft.com')}
                title="Login as Managing Director / Executive"
              >
                <span>🏢</span>
                <span><strong>MD</strong> (Executive)</span>
              </button>
              <button
                type="button"
                className="gov-role-chip"
                onClick={() => fillQuickCreds('sunil.verma@skandasoft.com')}
                title="Login as Department Head"
              >
                <span>💼</span>
                <span><strong>Dept</strong> Head</span>
              </button>
              <button
                type="button"
                className="gov-role-chip"
                onClick={() => fillQuickCreds('ravi.kumar@skandasoft.com')}
                title="Login as Section Staff"
              >
                <span>📦</span>
                <span><strong>Section</strong> Staff</span>
              </button>
              <button
                type="button"
                className="gov-role-chip"
                onClick={() => fillQuickCreds('admin@skandasoft.com')}
                title="Login as System Admin"
              >
                <span>⚙️</span>
                <span><strong>System</strong> Admin</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Clean Minimal Footer */}
      <footer style={{ textAlign: 'center', padding: '1rem', fontSize: '0.74rem', color: 'var(--text-light)', borderTop: '1px solid var(--border-color)', background: 'var(--bg-glass)' }}>
        <div>
          © {new Date().getFullYear()} DMS Pro. Enterprise Document Management System. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, KeyRound, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { homePath } from '../utils/home';

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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

  return (
    <div className="login-screen">
      <div className="login-card">
        <div style={{ textAlign: 'center' }}>
          <div className="brand-orb">
            <ShieldCheck size={30} />
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em' }}>DMS Pro Sign In</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-light)', marginTop: '0.25rem' }}>
            Enter your credentials to access the portal
          </p>
        </div>

        <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          {error && <div role="alert" className="alert alert-error">{error}</div>}

          <div>
            <label htmlFor="login-email" className="field-label">Login Email</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input
                id="login-email"
                className="field-control"
                type="email"
                required
                autoComplete="username"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ paddingLeft: '2.5rem' }}
              />
            </div>
          </div>

          <div>
            <label htmlFor="login-password" className="field-label">Login Password</label>
            <div style={{ position: 'relative' }}>
              <KeyRound size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input
                id="login-password"
                className="field-control"
                type="password"
                required
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingLeft: '2.5rem' }}
              />
            </div>
          </div>

          <button type="submit" disabled={busy} className="btn btn-primary btn-lg" style={{ marginTop: '0.35rem', width: '100%' }}>
            <ArrowRight size={18} />
            {busy ? 'Signing in...' : 'Sign In to Portal'}
          </button>
        </form>
      </div>
    </div>
  );
}

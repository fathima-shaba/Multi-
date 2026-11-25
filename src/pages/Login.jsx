import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

export default function Login() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { login, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const from = location.state?.from;
  const next = typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') && !from.includes('\\') ? from : '/';

  async function handleSubmit(event) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setError('');
    setBusy(true);
    try {
      await login(fields);
      navigate(next, { replace: true });
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container card">
        <div className="auth-header">
          <div className="auth-icon bg-primary-light"><LogIn size={32} /></div>
          <h2>Welcome Back</h2>
          <p>Login to your account to continue</p>
        </div>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="input-group">
            <label htmlFor="login-email">Email Address</label>
            <input id="login-email" name="email" type="email" className="input" autoComplete="email" maxLength={254} required />
          </div>
          <div className="input-group">
            <label htmlFor="login-password">Password</label>
            <input id="login-password" name="password" type="password" className="input"
              autoComplete="current-password" maxLength={128} required />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={busy || loading}>
            {busy ? 'Signing in…' : 'Login'}
          </button>
        </form>
        <div className="auth-footer">
          Don't have an account? <Link to="/register" state={location.state}>Sign Up</Link>
        </div>
      </div>
    </div>
  );
}

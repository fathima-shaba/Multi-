import { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

export default function Register() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [registered, setRegistered] = useState(false);
  const { register, loading } = useAuth();
  const location = useLocation();
  const from = location.state?.from;
  const next = typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') && !from.includes('\\') ? from : '/';

  async function handleSubmit(event) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setError('');
    setBusy(true);
    try {
      await register(fields);
      setRegistered(true);
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
          <div className="auth-icon bg-primary-light"><UserPlus size={32} /></div>
          <h2>Create Account</h2>
          <p>Sign up to start shopping</p>
        </div>
        {error && <div className="auth-error" role="alert">{error}</div>}
        {registered ? (
          <>
            <p role="status">Account created. You are signed in.</p>
            <Link className="btn btn-primary btn-block" to={next}>Continue</Link>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="input-group">
              <label htmlFor="register-name">Full Name</label>
              <input id="register-name" name="name" className="input" autoComplete="name" minLength={2} maxLength={100} required />
            </div>
            <div className="input-group">
              <label htmlFor="register-email">Email Address</label>
              <input id="register-email" name="email" type="email" className="input" autoComplete="email" maxLength={254} required />
            </div>
            <div className="input-group">
              <label htmlFor="register-phone">Phone Number</label>
              <input id="register-phone" name="phone" type="tel" className="input" autoComplete="tel-national" pattern="[0-9]{10}" required />
            </div>
            <div className="input-group">
              <label htmlFor="register-password">Password</label>
              <input id="register-password" name="password" type="password" className="input"
                autoComplete="new-password" minLength={12} maxLength={128} required />
              <small>Use 12–128 characters.</small>
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={busy || loading}>
              {busy ? 'Creating account…' : 'Sign Up'}
            </button>
          </form>
        )}
        {!registered && <div className="auth-footer">
          Already have an account? <Link to="/login" state={location.state}>Login</Link>
        </div>}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { accountRequest } from '../api/account';

function AdminAccess({ children }) {
  const [status, setStatus] = useState('pending');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    accountRequest('/admin/access', { signal: controller.signal }).then(() => {
      if (!controller.signal.aborted) setStatus('allowed');
    }).catch(error => {
      if (!controller.signal.aborted) setStatus(error.status === 403 ? 'denied' : 'failed');
    });
    return () => controller.abort();
  }, [attempt]);
  if (status === 'allowed') return children;
  if (status === 'denied') return <Navigate to="/" replace />;
  if (status === 'failed') return (
    <div className="container">
      <p role="alert">Could not verify administrator access.</p>
      <button className="btn btn-primary" onClick={() => { setStatus('pending'); setAttempt(previous => previous + 1); }}>Try Again</button>
    </div>
  );
  return <p className="container" role="status">Checking administrator access…</p>;
}

export default function AccountGate({ children, admin = false }) {
  const { user, loading, sessionError, retrySession } = useAuth();
  const location = useLocation();
  if (loading) return <p className="container" role="status">Checking your session…</p>;
  if (sessionError) return (
    <div className="container">
      <p role="alert">{sessionError}</p>
      <button className="btn btn-primary" onClick={retrySession}>Try Again</button>
    </div>
  );
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (admin && user.role !== 'admin') return <Navigate to="/" replace />;
  return admin ? <AdminAccess key={user.id}>{children}</AdminAccess> : children;
}

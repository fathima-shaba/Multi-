import { createContext, useContext, useEffect, useState } from 'react';
import { accountRequest } from '../api/account';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // Remove the old mock identity without reading or migrating it.
    try { localStorage.removeItem('user'); } catch { /* Browser storage may be disabled. */ }
    const endSession = () => setUser(null);
    window.addEventListener('multistore:session-ended', endSession);
    return () => window.removeEventListener('multistore:session-ended', endSession);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    accountRequest('/auth/me', { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) setUser(result.user);
    }).catch(error => {
      if (!controller.signal.aborted && error.status !== 401) setSessionError(error.message);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [attempt]);

  async function authenticate(path, body) {
    const { user: signedIn } = await accountRequest(path, { method: 'POST', body });
    setUser(signedIn);
    setSessionError('');
    setLoading(false);
  }

  async function logout() {
    await accountRequest('/auth/logout', { method: 'POST' });
    setUser(null);
  }

  function retrySession() {
    setSessionError('');
    setLoading(true);
    setAttempt(previous => previous + 1);
  }

  return (
    <AuthContext.Provider value={{
      user, loading, sessionError, retrySession, logout, updateUser: setUser,
      login: fields => authenticate('/auth/login', fields),
      register: fields => authenticate('/auth/register', fields),
      isAdmin: user?.role === 'admin',
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

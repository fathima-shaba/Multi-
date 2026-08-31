import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }, [user]);

  const login = (email, password) => {
    // Mock login logic
    if (email === 'admin@admin.com' && password === 'admin') {
      setUser({ id: '1', name: 'Admin', email, role: 'admin' });
      return true;
    } else if (email && password) {
      setUser({ id: Date.now().toString(), name: email.split('@')[0], email, role: 'user' });
      return true;
    }
    return false;
  };

  const register = (name, email, password) => {
    setUser({ id: Date.now().toString(), name, email, role: 'user' });
    return true;
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { connectSocket, disconnectSocket } from '../lib/socket';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback((loggedInUser) => {
    setUser(loggedInUser);
    if (loggedInUser) {
      connectSocket();
    } else {
      disconnectSocket();
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    api.auth
      .me()
      .then(({ user: u }) => {
        if (mounted) applySession(u);
      })
      .catch(() => {
        if (mounted) applySession(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [applySession]);

  const login = useCallback(
    async (email, password) => {
      const { user: u } = await api.auth.login(email, password);
      applySession(u);
      return u;
    },
    [applySession]
  );

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      // ignore network errors on logout
    }
    applySession(null);
  }, [applySession]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
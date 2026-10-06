import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [activeClientId, setActiveClientId] = useState(() => localStorage.getItem('activeClientId') || '');
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setActiveClientId('');
    localStorage.removeItem('token');
    localStorage.removeItem('activeClientId');
  }, []);

  const refreshUser = useCallback(async () => {
    const response = await api.get('/auth/me');
    const nextUser = response.data?.data?.user;
    if (!response.data?.success || !nextUser) {
      throw new Error('Unable to load your account.');
    }
    if (nextUser.role !== 'superadmin') {
      localStorage.removeItem('activeClientId');
      setActiveClientId('');
    }
    setUser(nextUser);
    return nextUser;
  }, []);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      if (!localStorage.getItem('token')) {
        if (active) setLoading(false);
        return;
      }

      try {
        await refreshUser();
      } catch {
        if (active) logout();
      } finally {
        if (active) setLoading(false);
      }
    }

    loadSession();
    return () => {
      active = false;
    };
  }, [logout, refreshUser]);

  const login = async (email, password) => {
    localStorage.removeItem('activeClientId');
    setActiveClientId('');
    const response = await api.post('/auth/login', { email, password });
    const authData = response.data?.data;
    if (!response.data?.success || !authData?.token || !authData?.user) {
      throw new Error(response.data?.error?.message || 'Login failed');
    }

    localStorage.setItem('token', authData.token);
    setToken(authData.token);
    setUser(authData.user);
    return authData.user;
  };

  const selectActiveClient = useCallback((clientId) => {
    const nextId = clientId || '';
    setActiveClientId(nextId);
    if (nextId) localStorage.setItem('activeClientId', nextId);
    else localStorage.removeItem('activeClientId');
  }, []);

  const value = {
    token,
    user,
    role: user?.role || null,
    clientId: user?.clientId || null,
    activeClientId,
    isAuthenticated: Boolean(token && user),
    loading,
    login,
    logout,
    refreshUser,
    selectActiveClient,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../services/api';
import { can as canCheck } from '../../../shared/permissions.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [activeClientId, setActiveClientId] = useState(() => localStorage.getItem('activeClientId') || '');
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {}
    setUser(null);
    setActiveClientId('');
    localStorage.removeItem('activeClientId');
  }, []);

  const logoutAll = useCallback(async () => {
    try {
      await api.post('/auth/logout-all');
    } catch {}
    setUser(null);
    setActiveClientId('');
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
      try {
        await refreshUser();
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadSession();
    return () => {
      active = false;
    };
  }, [refreshUser]);

  const login = async (email, password) => {
    localStorage.removeItem('activeClientId');
    setActiveClientId('');
    const response = await api.post('/auth/login', { email, password });
    const authData = response.data?.data;
    if (!response.data?.success || !authData?.user) {
      throw new Error(response.data?.error?.message || 'Login failed');
    }

    setUser(authData.user);
    return authData.user;
  };

  const selectActiveClient = useCallback((clientId) => {
    const nextId = clientId || '';
    setActiveClientId(nextId);
    if (nextId) localStorage.setItem('activeClientId', nextId);
    else localStorage.removeItem('activeClientId');
  }, []);

  const can = useCallback(
    (permission, resource = null) => canCheck(user, permission, resource),
    [user]
  );

  const value = {
    user,
    role: user?.role || null,
    clientId: user?.clientId || null,
    activeClientId,
    permissions: user?.permissions || [],
    can,
    isAuthenticated: Boolean(user),
    loading,
    login,
    logout,
    logoutAll,
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

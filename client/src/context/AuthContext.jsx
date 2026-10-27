import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../services/api';
import { can as canCheck } from '../../../shared/permissions.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [activeClientId, setActiveClientId] = useState(() => localStorage.getItem('activeClientId') || '');
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('hasSession')));

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {}
    localStorage.removeItem('hasSession');
    setUser(null);
    setActiveClientId('');
    localStorage.removeItem('activeClientId');
  }, []);

  const logoutAll = useCallback(async () => {
    try {
      await api.post('/auth/logout-all');
    } catch {}
    localStorage.removeItem('hasSession');
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
    localStorage.setItem('hasSession', 'true');
    setUser(nextUser);
    return nextUser;
  }, []);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      // If user has no active session flag, don't stall the UI with an unnecessary remote network call
      if (!localStorage.getItem('hasSession')) {
        if (active) setLoading(false);
        return;
      }

      try {
        await refreshUser();
      } catch (err) {
        if (active) {
          localStorage.removeItem('hasSession');
          setUser(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadSession();
    return () => {
      active = false;
    };
  }, [refreshUser]);

  // Keep server awake and session fresh while user has tab open
  // Render spins down free web services after 15 minutes of inactivity; pinging every 10m prevents spin-down.
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      api.get('/health').catch(() => {});
    }, 10 * 60 * 1000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        api.get('/health').catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [user]);

  const login = async (email, password) => {
    localStorage.removeItem('activeClientId');
    setActiveClientId('');
    const response = await api.post('/auth/login', { email, password });
    const authData = response.data?.data;
    if (!response.data?.success || !authData?.user) {
      throw new Error(response.data?.error?.message || 'Login failed');
    }

    localStorage.setItem('hasSession', 'true');
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

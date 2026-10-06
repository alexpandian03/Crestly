import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, allowedRoles, requireActiveClient = false }) {
  const { isAuthenticated, user, loading, activeClientId } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted">Checking your account…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles?.length && !allowedRoles.includes(user?.role)) {
    return (
      <Navigate
        to="/access-denied"
        state={{ message: "You don't have access to that page." }}
        replace
      />
    );
  }

  if (requireActiveClient && user?.role === 'superadmin' && !activeClientId) {
    return (
      <Navigate
        to="/access-denied"
        state={{ message: 'Select an organization from the header before opening this page.' }}
        replace
      />
    );
  }

  return children;
}

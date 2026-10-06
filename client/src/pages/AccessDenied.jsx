import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function homeForRole(role) {
  if (role === 'superadmin') return '/clients';
  if (role === 'clientadmin') return '/dashboard';
  return '/create';
}

export default function AccessDenied() {
  const location = useLocation();
  const { user } = useAuth();
  const [message] = useState(
    () => location.state?.message || sessionStorage.getItem('accessDeniedMessage') || "You don't have access to that page."
  );

  useEffect(() => {
    sessionStorage.removeItem('accessDeniedMessage');
  }, []);

  return (
    <div className="container-page section-pad">
      <div className="max-w-lg mx-auto card-surface p-8 text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-card bg-danger/10 text-danger flex items-center justify-center">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h1 className="text-2xl">You don&apos;t have access</h1>
        <p className="text-sm text-muted">{message}</p>
        <Link to={homeForRole(user?.role)} className="btn-primary">
          <ArrowLeft className="w-4 h-4" />
          Return to your workspace
        </Link>
      </div>
    </div>
  );
}

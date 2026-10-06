import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';
import { APP_NAME } from '../config/brand';

function landingForRole(role) {
  if (role === 'superadmin') return '/clients';
  if (role === 'clientadmin') return '/dashboard';
  return '/create';
}

export default function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sessionMessage] = useState(() => {
    const message = sessionStorage.getItem('authMessage') || '';
    sessionStorage.removeItem('authMessage');
    return message;
  });

  useEffect(() => {
    if (isAuthenticated && user) navigate(landingForRole(user.role), { replace: true });
  }, [isAuthenticated, navigate, user]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const loggedInUser = await login(email.trim(), password);
      navigate(landingForRole(loggedInUser.role), { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          err.message ||
          'We could not sign you in. Check your email and password.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-section flex items-center justify-center p-4">
      <div className="w-full max-w-md card-surface p-8">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4"><Logo /></div>
          <h1 className="text-2xl tracking-tight">Log in to {APP_NAME}</h1>
          <p className="text-sm text-muted mt-2">Use the email your organization gave you.</p>
        </div>

        {sessionMessage && (
          <div className="mb-4 p-4 rounded-card border border-primary/20 bg-primary/5 text-body text-sm flex items-center gap-3" role="status">
            <Info className="w-5 h-5 text-primary shrink-0" />
            <span>{sessionMessage}</span>
          </div>
        )}
        {error && (
          <div className="mb-4 p-4 rounded-card border border-danger/30 bg-danger/5 text-danger text-sm flex items-center gap-3" role="alert">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-sm font-medium text-heading mb-1.5">Email</label>
            <input id="login-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" />
          </div>
          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-heading mb-1.5">Password</label>
            <input id="login-password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-field" />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full mt-2 py-3">
            {submitting ? 'Signing in…' : 'Log in'}
          </button>
        </form>
      </div>
    </div>
  );
}

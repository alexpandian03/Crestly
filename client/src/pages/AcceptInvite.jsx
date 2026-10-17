import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import Logo from '../components/Logo';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [inviteInfo, setInviteInfo] = useState(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError('Missing invitation token.');
      return;
    }

    async function fetchInvite() {
      try {
        const res = await api.get(`/auth/invite/${token}`);
        setInviteInfo(res.data?.data);
      } catch (err) {
        setError(
          err.response?.data?.error?.message ||
            'This invitation link is invalid or has expired.'
        );
      } finally {
        setLoading(false);
      }
    }

    fetchInvite();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 10) {
      setError('Password must be at least 10 characters long.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/auth/accept-invite', {
        token,
        name: name.trim(),
        password,
      });

      if (refreshUser) {
        await refreshUser().catch(() => {});
      }

      const role = res.data?.data?.user?.role;
      if (role === 'superadmin') navigate('/clients', { replace: true });
      else if (role === 'clientadmin') navigate('/dashboard', { replace: true });
      else navigate('/create', { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          'Could not accept invitation. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col justify-between bg-white px-4 py-8">
      <div className="mx-auto my-auto w-full max-w-[380px] space-y-6">
        <div className="space-y-2">
          <div className="mb-6 flex items-center">
            <Logo />
          </div>
          <h1 className="text-[24px] font-semibold tracking-tight text-[#111827]">
            Accept Invitation
          </h1>
          <p className="text-sm text-[#6B7280]">
            {inviteInfo?.clientName
              ? `Join ${inviteInfo.clientName} on PosterAI.`
              : 'Set up your account to get started.'}
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-[#2563EB]" />
          </div>
        ) : error && !inviteInfo ? (
          <div className="space-y-4 rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] p-4 text-xs text-[#DC2626]">
            <p>{error}</p>
            <a href="/login" className="inline-block text-[#2563EB] hover:underline">
              Back to sign in
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-[6px] border border-[#FCA5A5] bg-[#FEF2F2] p-2.5 text-xs text-[#DC2626]">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="invite-email" className="text-xs font-medium text-[#111827]">
                Email address
              </Label>
              <Input
                id="invite-email"
                type="email"
                readOnly
                disabled
                value={inviteInfo?.email || ''}
                className="h-9 rounded-[6px] border-[#E5E7EB] bg-[#F9FAFB] text-sm text-[#6B7280]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-name" className="text-xs font-medium text-[#111827]">
                Full name
              </Label>
              <Input
                id="invite-name"
                type="text"
                required
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                className="h-9 rounded-[6px] border-[#E5E7EB] bg-white text-sm text-[#111827] shadow-none focus-visible:ring-1 focus-visible:ring-[#2563EB]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-password" className="text-xs font-medium text-[#111827]">
                Password (min. 10 characters)
              </Label>
              <div className="relative">
                <Input
                  id="invite-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={10}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-9 rounded-[6px] border-[#E5E7EB] bg-white pr-9 text-sm text-[#111827] shadow-none focus-visible:ring-1 focus-visible:ring-[#2563EB]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center text-[#6B7280] hover:text-[#111827]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="h-9 w-full rounded-[6px] bg-[#2563EB] text-sm font-medium text-white shadow-none hover:bg-[#1D4ED8] disabled:opacity-50"
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Setting up account…
                </span>
              ) : (
                'Create account'
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

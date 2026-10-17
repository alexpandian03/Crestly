import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react';
import Logo from '../components/Logo';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import api from '../services/api';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 10) {
      setError('Password must be at least 10 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setSuccess(true);
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          'We could not reset your password. The link may have expired.'
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
            Choose a new password
          </h1>
          <p className="text-sm text-[#6B7280]">
            Must be at least 10 characters.
          </p>
        </div>

        {!token ? (
          <div className="rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] p-4 text-xs text-[#DC2626]">
            Invalid or missing password reset link. Please request a new one from the sign in page.
          </div>
        ) : success ? (
          <div className="space-y-4 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-4 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-[#16A34A]" />
            <p className="text-sm font-medium text-[#111827]">Password updated</p>
            <p className="text-xs text-[#6B7280]">
              Your password has been changed and other active sessions have been signed out.
            </p>
            <div className="pt-2">
              <Link
                to="/login"
                className="inline-block rounded-[6px] bg-[#2563EB] px-4 py-2 text-xs font-medium text-white hover:bg-[#1D4ED8]"
              >
                Sign in with new password
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-[6px] border border-[#FCA5A5] bg-[#FEF2F2] p-2.5 text-xs text-[#DC2626]">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="new-password" className="text-xs font-medium text-[#111827]">
                New Password
              </Label>
              <div className="relative">
                <Input
                  id="new-password"
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

            <div className="space-y-1.5">
              <Label htmlFor="confirm-password" className="text-xs font-medium text-[#111827]">
                Confirm Password
              </Label>
              <Input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={10}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-9 rounded-[6px] border-[#E5E7EB] bg-white text-sm text-[#111827] shadow-none focus-visible:ring-1 focus-visible:ring-[#2563EB]"
              />
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="h-9 w-full rounded-[6px] bg-[#2563EB] text-sm font-medium text-white shadow-none hover:bg-[#1D4ED8] disabled:opacity-50"
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving password…
                </span>
              ) : (
                'Save new password'
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import Logo from '../components/Logo';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function ForgotPassword() {
  const { user } = useAuth();
  const [email, setEmail] = useState(() => user?.email || '');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Something went wrong. Please try again.');
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
            Reset your password
          </h1>
          <p className="text-sm text-[#6B7280]">
            Enter your email and we'll send you a link to reset your password.
          </p>
        </div>

        {submitted ? (
          <div className="space-y-4 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-4 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-[#16A34A]" />
            <p className="text-sm font-medium text-[#111827]">Check your email</p>
            <p className="text-xs text-[#6B7280]">
              If an account exists with that email, a password reset link has been sent. The link expires in 30 minutes.
            </p>
            <div className="pt-2">
              <Link
                to={user ? "/security" : "/login"}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2563EB] hover:underline"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> {user ? "Back to security" : "Back to sign in"}
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
              <Label htmlFor="reset-email" className="text-xs font-medium text-[#111827]">
                Email address
              </Label>
              <Input
                id="reset-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@organization.com"
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
                  <Loader2 className="h-4 w-4 animate-spin" /> Sending link…
                </span>
              ) : (
                'Send reset link'
              )}
            </Button>

            <div className="text-center pt-2">
              <Link
                to={user ? "/security" : "/login"}
                className="inline-flex items-center gap-1.5 text-xs text-[#6B7280] hover:text-[#111827]"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> {user ? "Back to security" : "Back to sign in"}
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

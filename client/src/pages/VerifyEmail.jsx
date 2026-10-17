import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import Logo from '../components/Logo';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const { refreshUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError('Verification token is missing.');
      return;
    }

    async function verify() {
      try {
        await api.post('/auth/verify-email', { token });
        setSuccess(true);
        if (refreshUser) {
          await refreshUser().catch(() => {});
        }
      } catch (err) {
        setError(
          err.response?.data?.error?.message ||
            'This verification link is invalid or has expired.'
        );
      } finally {
        setLoading(false);
      }
    }

    verify();
  }, [token, refreshUser]);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col justify-between bg-white px-4 py-8">
      <div className="mx-auto my-auto w-full max-w-[380px] space-y-6 text-center">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>

        {loading ? (
          <div className="space-y-4">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#2563EB]" />
            <p className="text-sm text-[#6B7280]">Verifying your email address…</p>
          </div>
        ) : success ? (
          <div className="space-y-4 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-6">
            <CheckCircle2 className="mx-auto h-10 w-10 text-[#16A34A]" />
            <h1 className="text-lg font-semibold text-[#111827]">Email verified</h1>
            <p className="text-xs text-[#6B7280]">
              Your email address has been verified. You can now create posters without restrictions.
            </p>
            <div className="pt-2">
              <a
                href="/create"
                className="inline-block rounded-[6px] bg-[#2563EB] px-4 py-2 text-xs font-medium text-white hover:bg-[#1D4ED8]"
              >
                Go to Poster Generator
              </a>
            </div>
          </div>
        ) : (
          <div className="space-y-4 rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] p-6">
            <AlertCircle className="mx-auto h-10 w-10 text-[#DC2626]" />
            <h1 className="text-lg font-semibold text-[#111827]">Verification failed</h1>
            <p className="text-xs text-[#DC2626]">{error}</p>
            <div className="pt-2">
              <a href="/login" className="text-xs font-medium text-[#2563EB] hover:underline">
                Back to sign in
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

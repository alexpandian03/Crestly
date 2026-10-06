import React, { useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function ChangePasswordDialog({ open, mustChange, onClose, onSignedOut }) {
  const { refreshUser, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const reset = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
  };

  const close = () => {
    if (mustChange) return;
    reset();
    onClose();
  };

  const signOut = () => {
    logout();
    reset();
    onSignedOut();
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (newPassword.length < 10 || newPassword.length > 72 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setError('Use 10–72 characters with at least one letter and one number.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.');
      return;
    }
    try {
      setBusy(true);
      await api.post('/auth/change-password', { currentPassword, newPassword });
      await refreshUser();
      reset();
      onClose();
      toast.success('Password changed.');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'We could not change your password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-heading/40 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="change-password-title">
      <div className="w-full max-w-md card-surface p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="change-password-title" className="text-lg">Change password</h2>
            <p className="text-sm text-muted mt-1">Use 10–72 characters with a letter and a number.</p>
          </div>
          {!mustChange && (
            <button type="button" onClick={close} className="text-muted hover:text-heading" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        {mustChange && (
          <div className="rounded-card border border-primary/20 bg-primary/5 p-3 text-sm text-heading">
            You must change your temporary password before continuing.
          </div>
        )}
        {error && <div className="rounded-card border border-danger/30 bg-danger/5 p-3 text-sm text-danger" role="alert">{error}</div>}
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-heading mb-1.5">Current password</label>
            <input type="password" required autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-heading mb-1.5">New password</label>
            <input type="password" required minLength={10} maxLength={72} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-heading mb-1.5">Confirm new password</label>
            <input type="password" required minLength={10} maxLength={72} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="input-field" />
          </div>
          <div className="flex justify-end gap-2">
            {mustChange ? (
              <button type="button" onClick={signOut} className="btn-ghost">Log out</button>
            ) : (
              <button type="button" onClick={close} className="btn-ghost">Cancel</button>
            )}
            <button type="submit" disabled={busy} className="btn-primary">{busy ? 'Changing…' : 'Change password'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

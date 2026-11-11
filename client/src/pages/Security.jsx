import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  LogOut,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";

export default function Security() {
  const { logoutAll } = useAuth();

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  // Logout all dialog state
  const [logoutAllOpen, setLogoutAllOpen] = useState(false);
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError("");

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setChangingPassword(true);
    try {
      await api.post("/auth/change-password", {
        currentPassword,
        newPassword,
      });
      toast.success("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordError(
        err.response?.data?.error?.message ||
          err.message ||
          "Could not update password. Please check your current password."
      );
    } finally {
      setChangingPassword(false);
    }
  };

  const handleLogoutEverywhere = async () => {
    setLoggingOutAll(true);
    try {
      await logoutAll();
      toast.success("Signed out of all devices.");
      window.location.href = "/login";
    } catch (err) {
      toast.error(err.response?.data?.error?.message || "Could not sign out everywhere. Please try again.");
      setLoggingOutAll(false);
      setLogoutAllOpen(false);
    }
  };

  return (
    <div className="bg-white min-h-[calc(100vh-56px)]">
      <div className="max-w-[800px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div>
          <h1 className="text-[24px] font-semibold text-[#111827] leading-tight">
            Security & Sign-in
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Manage your account password and active sessions.
          </p>
        </div>

        {/* 1. Password Section */}
        <div className="rounded-[8px] border border-[#E5E7EB] bg-white p-6 shadow-none space-y-4">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-[#2563EB]" />
            <h2 className="text-base font-semibold text-[#111827]">Change Password</h2>
          </div>
          <p className="text-xs text-[#6B7280]">
            Use a password with at least 10 characters that is unique to this account.
          </p>

          <form onSubmit={handleChangePassword} className="space-y-3 max-w-md pt-1">
            {passwordError && (
              <div className="flex items-center gap-2 rounded-[6px] border border-[#FCA5A5] bg-[#FEF2F2] p-2.5 text-xs text-[#DC2626]">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="current-pw" className="text-xs font-medium text-[#111827]">
                  Current password
                </Label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-[#2563EB] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="current-pw"
                  type={showCurrent ? "text" : "password"}
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="h-9 rounded-[6px] border-[#E5E7EB] pr-9 text-sm text-[#111827] focus-visible:ring-1 focus-visible:ring-[#2563EB]"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center text-[#6B7280]"
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="new-pw" className="text-xs font-medium text-[#111827]">
                New password
              </Label>
              <div className="relative">
                <Input
                  id="new-pw"
                  type={showNew ? "text" : "password"}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-9 rounded-[6px] border-[#E5E7EB] pr-9 text-sm text-[#111827] focus-visible:ring-1 focus-visible:ring-[#2563EB]"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center text-[#6B7280]"
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="confirm-pw" className="text-xs font-medium text-[#111827]">
                Confirm new password
              </Label>
              <Input
                id="confirm-pw"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-9 rounded-[6px] border-[#E5E7EB] text-sm text-[#111827] focus-visible:ring-1 focus-visible:ring-[#2563EB]"
              />
            </div>

            <Button
              type="submit"
              disabled={changingPassword || !currentPassword || !newPassword}
              className="mt-2 h-9 rounded-[6px] bg-[#2563EB] text-xs font-medium text-white shadow-none hover:bg-[#1D4ED8] disabled:opacity-50"
            >
              {changingPassword ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Updating password…
                </span>
              ) : (
                "Update password"
              )}
            </Button>
          </form>
        </div>

        {/* 2. Active Sessions Card */}
        <div className="rounded-[8px] border border-[#E5E7EB] bg-white p-6 shadow-none flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <LogOut className="h-4 w-4 text-[#6B7280]" />
              <h2 className="text-base font-semibold text-[#111827]">Sign out of all devices</h2>
            </div>
            <p className="text-xs text-[#6B7280]">
              Sign out of all active web sessions across all browsers and devices, including this one.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setLogoutAllOpen(true)}
            className="h-8 rounded-[6px] border-[#E5E7EB] text-xs font-medium text-[#DC2626] hover:bg-[#FEF2F2] hover:text-[#DC2626] shrink-0 self-start sm:self-auto"
          >
            Sign out everywhere
          </Button>
        </div>
      </div>

      {/* Logout Everywhere Dialog */}
      <Dialog open={logoutAllOpen} onOpenChange={setLogoutAllOpen}>
        <DialogContent className="max-w-[400px] rounded-[8px] bg-white p-6 shadow-lg">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-base font-semibold text-[#111827]">
              Sign out of all devices?
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6B7280] leading-relaxed">
              This will sign you out everywhere, including this web browser. You will need to sign in again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLogoutAllOpen(false)}
              className="h-9 rounded-[6px] border-[#E5E7EB] text-xs font-medium text-[#374151]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={loggingOutAll}
              onClick={handleLogoutEverywhere}
              className="h-9 rounded-[6px] bg-[#DC2626] text-xs font-medium text-white hover:bg-[#B91C1C]"
            >
              {loggingOutAll ? "Signing out everywhere…" : "Sign out everywhere"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

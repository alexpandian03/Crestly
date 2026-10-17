import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  Eye,
  EyeOff,
  Laptop,
  Loader2,
  Lock,
  Shield,
  Smartphone,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { timeAgo } from "../utils/timeAgo";

function parseDevice(ua) {
  if (!ua) return { name: "Web browser", icon: Laptop };
  const str = ua.toLowerCase();
  let browser = "Web browser";
  if (str.includes("edg/")) browser = "Microsoft Edge";
  else if (str.includes("chrome/")) browser = "Google Chrome";
  else if (str.includes("firefox/")) browser = "Mozilla Firefox";
  else if (str.includes("safari/") && !str.includes("chrome")) browser = "Safari";

  let os = "Desktop";
  let icon = Laptop;
  if (str.includes("iphone") || str.includes("ipad") || str.includes("android") || str.includes("mobile")) {
    os = str.includes("iphone") ? "iPhone" : str.includes("ipad") ? "iPad" : "Mobile";
    icon = Smartphone;
  } else if (str.includes("windows")) {
    os = "Windows";
  } else if (str.includes("mac os") || str.includes("macintosh")) {
    os = "macOS";
  } else if (str.includes("linux")) {
    os = "Linux";
  }

  return { name: `${browser} on ${os}`, icon };
}

export default function Security() {
  const { user, logout, logoutAll } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [securityData, setSecurityData] = useState({
    sessions: [],
    recentSignIns: [],
  });

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  // Session revoke confirm state
  const [sessionToRevoke, setSessionToRevoke] = useState(null);
  const [revokingSession, setRevokingSession] = useState(false);
  const [logoutAllOpen, setLogoutAllOpen] = useState(false);
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  const fetchSecurityData = async () => {
    try {
      const res = await api.get("/auth/security");
      if (res.data?.success) {
        setSecurityData(res.data.data);
      }
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          "Could not load security details. Please refresh the page."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurityData();
  }, []);

  // 1. Password change handler
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

  // 3. Session Revoke handler
  const handleRevokeSession = async () => {
    if (!sessionToRevoke) return;
    setRevokingSession(true);
    try {
      const res = await api.delete(`/auth/sessions/${sessionToRevoke.id}`);
      if (res.data?.data?.isCurrent) {
        toast.success("Current session signed out.");
        await logout();
        window.location.href = "/login";
        return;
      }
      toast.success("Device signed out.");
      setSessionToRevoke(null);
      fetchSecurityData();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || "Could not sign out device.");
    } finally {
      setRevokingSession(false);
    }
  };

  const handleLogoutEverywhere = async () => {
    setLoggingOutAll(true);
    try {
      await logoutAll();
      toast.success("Signed out of all devices.");
      window.location.href = "/login";
    } catch (err) {
      toast.error("Could not sign out everywhere. Please try again.");
      setLoggingOutAll(false);
      setLogoutAllOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white min-h-[calc(100vh-56px)] flex items-center justify-center p-8">
        <div className="flex items-center gap-3 text-sm text-[#6B7280]">
          <Loader2 className="h-5 w-5 animate-spin text-[#2563EB]" />
          <span>Loading security details…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-[calc(100vh-56px)]">
      <div className="max-w-[800px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div>
          <h1 className="text-[24px] font-semibold text-[#111827] leading-tight">
            Security & Sign-in
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Manage your account password and connected devices.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-[6px] border border-[#FCA5A5] bg-[#FEF2F2] p-3 text-xs text-[#DC2626]">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

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

        {/* 3. Connected Devices (Active Sessions) */}
        <div className="rounded-[8px] border border-[#E5E7EB] bg-white p-6 shadow-none space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Laptop className="h-4 w-4 text-[#2563EB]" />
              <h2 className="text-base font-semibold text-[#111827]">Devices signed in</h2>
            </div>
            {securityData.sessions.length > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setLogoutAllOpen(true)}
                className="h-8 rounded-[6px] border-[#E5E7EB] text-xs font-medium text-[#374151] hover:bg-[#F9FAFB]"
              >
                Sign out everywhere
              </Button>
            )}
          </div>
          <p className="text-xs text-[#6B7280]">
            These web browsers and devices are currently signed in to your account.
          </p>

          <div className="divide-y divide-[#E5E7EB] border border-[#E5E7EB] rounded-[6px] overflow-hidden">
            {securityData.sessions.map((sess) => {
              const device = parseDevice(sess.userAgent);
              const DeviceIcon = device.icon;
              return (
                <div key={sess.id} className="p-3 sm:px-4 flex items-center justify-between gap-3 bg-white">
                  <div className="flex items-center gap-3">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded bg-[#F3F4F6] text-[#4B5563]">
                      <DeviceIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-[#111827]">{device.name}</span>
                        {sess.isCurrent && (
                          <Badge className="bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE] text-[10px] py-0 px-1.5 font-medium">
                            This device
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-[#6B7280] mt-0.5">
                        Last used {timeAgo(sess.lastUsedAt)}
                      </p>
                    </div>
                  </div>

                  {!sess.isCurrent && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setSessionToRevoke(sess)}
                      className="h-8 rounded-[6px] text-xs text-[#DC2626] hover:bg-[#FEF2F2] hover:text-[#DC2626]"
                    >
                      Sign out
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Recent Sign-in Activity */}
        <div className="rounded-[8px] border border-[#E5E7EB] bg-white p-6 shadow-none space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-[#2563EB]" />
            <h2 className="text-base font-semibold text-[#111827]">Recent sign-ins</h2>
          </div>
          <p className="text-xs text-[#6B7280]">
            Recent sign-in attempts on your account.
          </p>

          <div className="divide-y divide-[#E5E7EB] border border-[#E5E7EB] rounded-[6px] overflow-hidden">
            {securityData.recentSignIns.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#6B7280]">
                No recent sign-ins recorded.
              </div>
            ) : (
              securityData.recentSignIns.map((ev) => {
                const device = parseDevice(ev.userAgent);
                return (
                  <div key={ev.id} className="p-3 sm:px-4 flex items-center justify-between text-xs bg-white">
                    <div>
                      <span className="font-medium text-[#111827]">{device.name}</span>
                      <p className="text-[11px] text-[#6B7280] mt-0.5">
                        {new Date(ev.createdAt).toLocaleString()} · {timeAgo(ev.createdAt)}
                      </p>
                    </div>
                    <div>
                      {ev.result === "success" ? (
                        <Badge className="bg-[#DCFCE7] text-[#15803D] border-[#86EFAC] text-[10px] py-0 px-1.5 font-medium">
                          Signed in
                        </Badge>
                      ) : (
                        <Badge className="bg-[#FEF2F2] text-[#DC2626] border-[#FCA5A5] text-[10px] py-0 px-1.5 font-medium">
                          Failed attempt
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Revoke Individual Device Dialog */}
      <Dialog open={Boolean(sessionToRevoke)} onOpenChange={(open) => !open && setSessionToRevoke(null)}>
        <DialogContent className="max-w-[400px] rounded-[8px] bg-white p-6 shadow-lg">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-base font-semibold text-[#111827]">
              Sign out this device?
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6B7280] leading-relaxed">
              Anyone using that device will be signed out and will need to sign in again with their password.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSessionToRevoke(null)}
              className="h-9 rounded-[6px] border-[#E5E7EB] text-xs font-medium text-[#374151]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={revokingSession}
              onClick={handleRevokeSession}
              className="h-9 rounded-[6px] bg-[#DC2626] text-xs font-medium text-white hover:bg-[#B91C1C]"
            >
              {revokingSession ? "Signing out…" : "Sign out device"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

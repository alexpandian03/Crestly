import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Eye, EyeOff, Info, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Logo from "../components/Logo";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

function landingForRole(role) {
  if (role === "superadmin") return "/clients";
  if (role === "clientadmin") return "/dashboard";
  return "/create";
}

export default function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sessionMessage] = useState(() => {
    const message = sessionStorage.getItem("authMessage") || "";
    sessionStorage.removeItem("authMessage");
    return message;
  });

  useEffect(() => {
    if (isAuthenticated && user)
      navigate(landingForRole(user.role), { replace: true });
  }, [isAuthenticated, navigate, user]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const loggedInUser = await login(email.trim(), password);
      navigate(landingForRole(loggedInUser.role), { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          err.message ||
          "We could not sign you in. Check your email and password.",
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
            Sign in
          </h1>
          <p className="text-sm text-[#6B7280]">
            Create on-brand posters in seconds.
          </p>
        </div>

        {sessionMessage && (
          <p
            role="status"
            className="flex items-center gap-1.5 text-xs text-[#2563EB]"
          >
            <Info className="h-3.5 w-3.5 shrink-0" />
            <span>{sessionMessage}</span>
          </p>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <Label
              htmlFor="login-email"
              className="text-xs font-medium text-[#111827]"
            >
              Email
            </Label>
            <Input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@organization.com"
              className="h-9 rounded-[6px] border-[#E5E7EB] bg-white text-sm text-[#111827] shadow-none focus-visible:ring-1 focus-visible:ring-[#2563EB]"
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="login-password"
              className="text-xs font-medium text-[#111827]"
            >
              Password
            </Label>
            <div className="relative">
              <Input
                id="login-password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-9 rounded-[6px] border-[#E5E7EB] bg-white pr-9 text-sm text-[#111827] shadow-none focus-visible:ring-1 focus-visible:ring-[#2563EB]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center text-[#6B7280] hover:text-[#111827]"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
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
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing in…
              </span>
            ) : (
              "Sign in"
            )}
          </Button>

          {error && (
            <p
              role="alert"
              className="flex items-center gap-1.5 text-xs text-[#DC2626]"
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </p>
          )}
        </form>
      </div>

      <footer className="text-center text-xs text-[#9CA3AF]">
        Brandframe · AI poster generator for teams
      </footer>
    </div>
  );
}

import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, KeyRound, LogOut, LogOutIcon } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { ROLE_LABELS } from "./navItems";

function initialsOf(name, email) {
  const source = String(name || email || "?").trim();
  const parts = source.split(/[\s._@-]+/).filter(Boolean);
  const letters = parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
  return (letters || source[0] || "?").toUpperCase();
}

export default function UserMenu({ onPassword }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target))
        setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const signOut = () => {
    logout();
    setOpen(false);
    navigate("/login");
  };

  /** Forgets every credential this app stored in the browser; other devices keep their own token. */
  const signOutEverywhere = () => {
    ["token", "activeClientId", "bf-sidebar-collapsed", "bf-theme"].forEach(
      (key) => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      },
    );
    sessionStorage.removeItem("authMessage");
    sessionStorage.removeItem("accessDeniedMessage");
    signOut();
    toast.success(
      "Signed out on this device. Other devices sign out when their session ends.",
    );
  };

  const itemClass =
    "w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-body hover:bg-section hover:text-heading";

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-btn border border-line bg-canvas pl-1.5 pr-1.5 py-1.5 sm:pr-2.5 text-sm font-medium text-heading transition-colors hover:border-primary"
      >
        <span
          aria-hidden="true"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-white"
        >
          {initialsOf(user?.name, user?.email)}
        </span>
        <span className="hidden sm:block max-w-[10rem] truncate">
          {user?.name}
        </span>
        <span className="shrink-0 whitespace-nowrap rounded-chip bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
          {ROLE_LABELS[user?.role] || user?.role}
        </span>
        <ChevronDown
          className={`hidden sm:block h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 rounded-card border border-line bg-canvas shadow-soft py-1 z-50"
        >
          <div className="px-3.5 py-3 border-b border-line">
            <p className="text-sm font-semibold text-heading truncate">
              {user?.name}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground truncate">
              {user?.email}
            </p>
            <p className="mt-2 inline-flex items-center rounded-chip bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              {ROLE_LABELS[user?.role] || user?.role}
            </p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onPassword?.();
            }}
            className={itemClass}
          >
            <KeyRound className="h-4 w-4 shrink-0" /> Change password
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={signOutEverywhere}
            className={itemClass}
          >
            <LogOutIcon className="h-4 w-4 shrink-0" /> Log out of all devices
          </button>
          <div className="my-1 border-t border-line" />
          <button
            type="button"
            role="menuitem"
            onClick={signOut}
            className={itemClass}
          >
            <LogOut className="h-4 w-4 shrink-0" /> Log out
          </button>
        </div>
      )}
    </div>
  );
}

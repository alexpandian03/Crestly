import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, KeyRound, LogOut, LogOutIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { ROLE_LABELS } from './navItems';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

function initialsOf(name, email) {
  const source = String(name || email || '?').trim();
  const parts = source.split(/[\s._@-]+/).filter(Boolean);
  const letters = parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
  return (letters || source[0] || '?').toUpperCase();
}

export default function UserMenu({ onPassword }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const signOut = () => {
    logout();
    navigate('/login');
  };

  /** Forgets every credential stored in browser; other devices keep their own token. */
  const signOutEverywhere = () => {
    ['token', 'activeClientId', 'bf-sidebar-collapsed', 'bf-theme'].forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
    sessionStorage.removeItem('authMessage');
    sessionStorage.removeItem('accessDeniedMessage');
    signOut();
    toast.success('Signed out on this device. Other devices sign out when their session ends.');
  };

  const roleText = ROLE_LABELS[user?.role] || user?.role || 'Member';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-[6px] p-1 sm:px-2 sm:py-1.5 transition-colors hover:bg-[#F3F4F6] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#E5E7EB]"
          aria-label="User account menu"
        >
          {/* Small gray avatar with initial */}
          <span
            aria-hidden="true"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#E5E7EB] text-xs font-semibold text-[#4B5563]"
          >
            {initialsOf(user?.name, user?.email)}
          </span>

          {/* Name & role as plain gray text (NOT a purple pill) */}
          <div className="hidden sm:flex flex-col items-start text-left leading-tight">
            <span className="text-sm font-medium text-[#111827] max-w-[130px] truncate">
              {user?.name || 'User'}
            </span>
            <span className="text-xs text-[#6B7280]">
              {roleText}
            </span>
          </div>

          <ChevronDown className="hidden sm:block h-3.5 w-3.5 text-[#6B7280] shrink-0" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-56 rounded-[8px] border border-[#E5E7EB] bg-white p-1 text-[#111827] shadow-md"
      >
        <div className="px-2.5 py-2">
          <p className="text-sm font-medium text-[#111827] truncate">
            {user?.name || 'User'}
          </p>
          <p className="text-xs text-[#6B7280] truncate mt-0.5">
            {user?.email}
          </p>
          <p className="text-xs text-[#6B7280] mt-1">
            {roleText}
          </p>
        </div>

        <DropdownMenuSeparator className="bg-[#E5E7EB] my-1" />

        <DropdownMenuItem
          onClick={onPassword}
          className="flex cursor-pointer items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-sm text-[#374151] hover:bg-[#F3F4F6] hover:text-[#111827] focus:bg-[#F3F4F6] focus:text-[#111827]"
        >
          <KeyRound className="h-4 w-4 text-[#6B7280]" />
          <span>Change password</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={signOutEverywhere}
          className="flex cursor-pointer items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-sm text-[#374151] hover:bg-[#F3F4F6] hover:text-[#111827] focus:bg-[#F3F4F6] focus:text-[#111827]"
        >
          <LogOutIcon className="h-4 w-4 text-[#6B7280]" />
          <span>Log out of all devices</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-[#E5E7EB] my-1" />

        <DropdownMenuItem
          onClick={signOut}
          className="flex cursor-pointer items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-sm text-[#DC2626] hover:bg-[#FEF2F2] hover:text-[#DC2626] focus:bg-[#FEF2F2] focus:text-[#DC2626]"
        >
          <LogOut className="h-4 w-4 text-[#DC2626]" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

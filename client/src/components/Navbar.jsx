import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';
import UserMenu from './shell/UserMenu';
import { guestNavItems, hasSidebar, homeForRole, memberNavItems } from './shell/navItems';

const inlineLinkClass = ({ isActive }) =>
  `shrink-0 whitespace-nowrap rounded-[6px] px-3 py-1.5 text-sm font-medium transition-colors ${
    isActive ? 'bg-[#F3F4F6] text-[#111827]' : 'text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]'
  }`;

export default function Navbar({ menuOpen, onToggleMenu, onPassword }) {
  const { user, isAuthenticated } = useAuth();
  const sidebar = isAuthenticated && hasSidebar(user);
  const items = !isAuthenticated ? guestNavItems : sidebar ? [] : memberNavItems;
  const hiddenClass = sidebar ? 'lg:hidden' : 'md:hidden';

  return (
    <header className="h-[56px] shrink-0 border-b border-[#E5E7EB] bg-white">
      <div className="mx-auto flex h-full w-full max-w-page items-center gap-2 px-4 sm:gap-4 sm:px-6">
        <button
          type="button"
          onClick={onToggleMenu}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          className={`${hiddenClass} shrink-0 rounded-[6px] border border-[#E5E7EB] p-1.5 text-[#111827] transition-colors hover:bg-[#F3F4F6]`}
        >
          {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>

        <Link to={isAuthenticated ? homeForRole(user?.role) : '/'} className="min-w-0 shrink-0">
          <Logo variant="full" />
        </Link>

        {items.length > 0 && (
          <nav className="ml-2 hidden items-center gap-1 md:flex" aria-label="Primary">
            {items.map((item) =>
              item.href ? (
                <a key={item.href} href={item.href} className={inlineLinkClass({ isActive: false })}>
                  {item.label}
                </a>
              ) : (
                <NavLink key={item.to} to={item.to} className={inlineLinkClass}>
                  {item.label}
                </NavLink>
              )
            )}
          </nav>
        )}

        <div className="ml-auto flex shrink-0 items-center">
          {isAuthenticated ? (
            <UserMenu onPassword={onPassword} />
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-[6px] bg-[#2563EB] px-3.5 py-1.5 text-sm font-medium text-white hover:bg-[#1D4ED8] transition-colors"
            >
              Log in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

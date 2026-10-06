import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';
import UserMenu from './shell/UserMenu';
import { guestNavItems, hasSidebar, homeForRole, memberNavItems } from './shell/navItems';

const inlineLinkClass = ({ isActive }) =>
  `shrink-0 whitespace-nowrap rounded-btn px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-section text-heading' : 'text-body hover:bg-section hover:text-heading'
  }`;

export default function Navbar({ menuOpen, onToggleMenu, onPassword }) {
  const { user, isAuthenticated } = useAuth();
  const sidebar = isAuthenticated && hasSidebar(user);
  const items = !isAuthenticated ? guestNavItems : sidebar ? [] : memberNavItems;
  const hiddenClass = sidebar ? 'lg:hidden' : 'md:hidden';

  return (
    <header className="h-16 shrink-0 border-b border-line bg-canvas">
      <div className="mx-auto flex h-full w-full max-w-page items-center gap-2 px-4 sm:gap-4 sm:px-6">
        <button
          type="button"
          onClick={onToggleMenu}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          className={`${hiddenClass} shrink-0 rounded-btn border border-line p-2 text-heading transition-colors hover:bg-section`}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <Link to={isAuthenticated ? homeForRole(user?.role) : '/'} className="min-w-0 shrink-0 rounded-btn">
          <Logo variant="full" />
        </Link>

        {items.length > 0 && (
          <nav className="ml-1 hidden items-center gap-1 md:flex" aria-label="Primary">
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
            <Link to="/login" className="btn-primary whitespace-nowrap">
              Log in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

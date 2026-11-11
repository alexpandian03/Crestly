import {
  Building2,
  CheckSquare,
  Images,
  LayoutDashboard,
  LayoutTemplate,
  Palette,
  Sparkles,
  Users,
} from 'lucide-react';
import { can } from '../../../../shared/permissions.js';

export const ROLE_LABELS = {
  superadmin: 'Super admin',
  clientadmin: 'Client admin',
  user: 'Member',
};

export function homeForRole(role) {
  if (role === 'superadmin') return '/clients';
  if (role === 'clientadmin') return '/create';
  return '/create';
}

export const guestNavItems = [];

export const memberNavItems = [
  { to: '/create', label: 'Create' },
  { to: '/posters', label: 'Posters' },
];

/** Standard items: Dashboard, Create, Posters, Brand kit, Templates, Team */
export const defaultNavItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/create', label: 'Create', icon: Sparkles },
  { to: '/posters', label: 'Posters', icon: Images },
  { to: '/brand-kit', label: 'Brand kit', icon: Palette },
  { to: '/team', label: 'Team', icon: Users },
];

export function navGroups(user) {
  if (!user) return [];

  if (user?.role === 'superadmin') {
    return [
      {
        items: [
          can(user, 'settings:read') ? { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard } : null,
          can(user, 'clients:manage') ? { to: '/clients', label: 'Organizations', icon: Building2 } : null,
          can(user, 'users:read') ? { to: '/users', label: 'Users', icon: Users } : null,
        ].filter(Boolean),
      },
      {
        needsClient: true,
        items: [
          { to: '/company-setup', label: 'Company setup', icon: CheckSquare },
          can(user, 'posters:create') ? { to: '/create', label: 'Create', icon: Sparkles } : null,
          can(user, 'posters:read:own') ? { to: '/posters', label: 'Posters', icon: Images } : null,
          can(user, 'brandkit:read') ? { to: '/brand-kit', label: 'Brand kit', icon: Palette } : null,
        ].filter(Boolean),
      },
    ];
  }

  if (user?.role === 'clientadmin') {
    return [
      {
        items: [
          can(user, 'posters:create') ? { to: '/create', label: 'Create', icon: Sparkles } : null,
          can(user, 'posters:read:own') ? { to: '/posters', label: 'Posters', icon: Images } : null,
          can(user, 'users:read') ? { to: '/team', label: 'Team', icon: Users } : null,
        ].filter(Boolean),
      },
    ];
  }

  // Regular user (Member)
  return [
    {
      items: [
        can(user, 'posters:create') ? { to: '/create', label: 'Create', icon: Sparkles } : null,
        can(user, 'posters:read:own') ? { to: '/posters', label: 'Posters', icon: Images } : null,
      ].filter(Boolean),
    },
  ];
}

export function hasSidebar(user) {
  return Boolean(user);
}

export function titleForPath(pathname) {
  if (pathname === '/dashboard') return 'Dashboard';
  if (pathname === '/create') return 'Create';
  if (pathname === '/posters') return 'Posters';
  if (pathname === '/brand-kit') return 'Brand kit';
    if (pathname === '/company-setup') return 'Company setup';
  if (pathname === '/team') return 'Team';
  if (pathname === '/security') return 'Security';
  if (pathname === '/clients') return 'Organizations';
  if (pathname === '/users') return 'Users';
      if (pathname === '/access-denied') return 'Access denied';
  return 'Brandframe';
}

const COLLAPSE_KEY = 'bf-sidebar-collapsed';

export function readCollapsed() {
  try {
    return sessionStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeCollapsed(collapsed) {
  try {
    sessionStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
  } catch {
    /* Private mode: the menu simply starts wide again next load. */
  }
}

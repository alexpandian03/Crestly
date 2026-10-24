import {
  Building2,
  Images,
  LayoutDashboard,
  LayoutTemplate,
  Palette,
  Sparkles,
  Users,
} from 'lucide-react';

export const ROLE_LABELS = {
  superadmin: 'Super admin',
  clientadmin: 'Client admin',
  user: 'Member',
};

export function homeForRole(role) {
  return '/dashboard';
}

export const guestNavItems = [
  { href: '/#templates', label: 'Templates' },
  { href: '/how-it-works', label: 'How it works' },
];

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
  { to: '/templates', label: 'Templates', icon: LayoutTemplate },
  { to: '/team', label: 'Team', icon: Users },
];

import { can } from '../../../../shared/permissions.js';

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
          can(user, 'posters:create') ? { to: '/create', label: 'Create', icon: Sparkles } : null,
          can(user, 'posters:read:own') ? { to: '/posters', label: 'Posters', icon: Images } : null,
          can(user, 'brandkit:read') ? { to: '/brand-kit', label: 'Brand kit', icon: Palette } : null,
          can(user, 'templates:read') ? { to: '/templates', label: 'Templates', icon: LayoutTemplate } : null,
        ].filter(Boolean),
      },
    ];
  }

  // Filter default items based on permissions
  const availableItems = defaultNavItems.filter((item) => {
    if (item.to === '/dashboard') return can(user, 'settings:read');
    if (item.to === '/create') return can(user, 'posters:create');
    if (item.to === '/posters') return can(user, 'posters:read:own');
    if (item.to === '/brand-kit') return can(user, 'brandkit:write');
    if (item.to === '/templates') return can(user, 'templates:write');
    if (item.to === '/team') return can(user, 'users:read');
    return false;
  });

  return [
    {
      items: availableItems,
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
  if (pathname === '/templates') return 'Templates';
  if (pathname === '/team') return 'Team';
  if (pathname === '/security') return 'Security';
  if (pathname === '/clients') return 'Organizations';
  if (pathname === '/users') return 'Users';
  if (pathname.startsWith('/templates/') && pathname.endsWith('/edit')) return 'Edit template';
  if (pathname === '/how-it-works') return 'How it works';
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

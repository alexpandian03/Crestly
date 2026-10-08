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
  if (role === 'superadmin') return '/clients';
  if (role === 'clientadmin') return '/dashboard';
  return '/create';
}

export const guestNavItems = [
  { href: '/#templates', label: 'Templates' },
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#pricing', label: 'Pricing' },
];

export const memberNavItems = [
  { to: '/create', label: 'Create' },
  { to: '/posters', label: 'Posters' },
];

/** Standard items requested: Dashboard, Create, Posters, Brand kit, Templates, Team */
export const defaultNavItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/create', label: 'Create', icon: Sparkles },
  { to: '/posters', label: 'Posters', icon: Images },
  { to: '/brand-kit', label: 'Brand kit', icon: Palette },
  { to: '/templates', label: 'Templates', icon: LayoutTemplate },
  { to: '/team', label: 'Team', icon: Users },
];

export function navGroups(user) {
  if (user?.role === 'superadmin') {
    return [
      {
        items: [
          { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { to: '/clients', label: 'Organizations', icon: Building2 },
          { to: '/users', label: 'Users', icon: Users },
        ],
      },
      {
        needsClient: true,
        items: [
          { to: '/create', label: 'Create', icon: Sparkles },
          { to: '/posters', label: 'Posters', icon: Images },
          { to: '/brand-kit', label: 'Brand kit', icon: Palette },
          { to: '/templates', label: 'Templates', icon: LayoutTemplate },
        ],
      },
    ];
  }

  if (user?.role === 'clientadmin') {
    return [
      {
        items: defaultNavItems,
      },
    ];
  }

  if (user?.role === 'user') {
    return [
      {
        items: [
          { to: '/create', label: 'Create', icon: Sparkles },
          { to: '/posters', label: 'Posters', icon: Images },
        ],
      },
    ];
  }

  return [];
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

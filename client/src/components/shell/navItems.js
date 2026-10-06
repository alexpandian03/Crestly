import {
  Building2,
  Images,
  LayoutDashboard,
  LayoutTemplate,
  Palette,
  Sparkles,
  UserCog,
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

/** Two-link top navigation for members, who have no sidebar. */
export const memberNavItems = [
  { to: '/create', label: 'Create' },
  { to: '/posters', label: 'Posters' },
];

const workspaceItems = [
  { to: '/create', label: 'Create', icon: Sparkles },
  { to: '/posters', label: 'Posters', icon: Images },
  { to: '/brand-kit', label: 'Brand kit', icon: Palette },
  { to: '/templates', label: 'Templates', icon: LayoutTemplate },
];

/**
 * Sidebar groups; superadmin workspace links need a chosen organization.
 */
export function navGroups(user) {
  if (user?.role === 'superadmin') {
    return [
      {
        label: 'Platform',
        items: [
          { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { to: '/clients', label: 'Organizations', icon: Building2 },
          { to: '/users', label: 'Users', icon: Users },
        ],
      },
      { label: 'Workspace', needsClient: true, items: workspaceItems },
    ];
  }
  if (user?.role === 'clientadmin') {
    return [
      {
        label: 'Workspace',
        items: [
          { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          ...workspaceItems,
          { to: '/team', label: 'Team', icon: UserCog },
        ],
      },
    ];
  }
  return [];
}

export function hasSidebar(user) {
  return user?.role === 'superadmin' || user?.role === 'clientadmin';
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

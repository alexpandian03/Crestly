/**
 * Permissions and Role-Based Access Control (RBAC).
 *
 * Pure isomorphic ESM - zero dependencies.
 * Used on server (in requirePermission middleware and controllers)
 * and on client (in can() UI helpers for menus, buttons and actions).
 */

export const PERMISSIONS = [
  'users:read',
  'users:invite',
  'users:create',
  'users:write',
  'users:deactivate',
  'brandkit:read',
  'brandkit:write',
  'templates:read',
  'templates:write',
  'posters:create',
  'posters:read:own',
  'posters:read:all',
  'posters:write:own',
  'posters:write:all',
  'posters:delete',
  'assets:read',
  'assets:create',
  'assets:delete',
  'clients:manage',
  'clients:read:own',
  'clients:write:own',
  'settings:read',
  'settings:write',
  'audit:read',
  'approvals:decide',
  'authenticated',
];

export const ROLE_PERMISSIONS = {
  superadmin: [
    'users:read',
    'users:invite',
    'users:create',
    'users:write',
    'users:deactivate',
    'brandkit:read',
    'brandkit:write',
    'templates:read',
    'templates:write',
    'posters:create',
    'posters:read:own',
    'posters:read:all',
    'posters:write:own',
    'posters:write:all',
    'posters:delete',
    'assets:read',
    'assets:create',
    'assets:delete',
    'clients:manage',
    'clients:read:own',
    'clients:write:own',
    'settings:read',
    'settings:write',
    'audit:read',
    'approvals:decide',
    'authenticated',
  ],
  clientadmin: [
    'users:read',
    'users:invite',
    'users:create',
    'users:write',
    'users:deactivate',
    'brandkit:read',
    'brandkit:write',
    'templates:read',
    'templates:write',
    'posters:create',
    'posters:read:own',
    'posters:read:all',
    'posters:write:own',
    'posters:write:all',
    'posters:delete',
    'assets:read',
    'assets:create',
    'assets:delete',
    'clients:read:own',
    'clients:write:own',
    'settings:read',
    'settings:write',
    'audit:read',
    'approvals:decide',
    'authenticated',
  ],
  user: [
    'brandkit:read',
    'templates:read',
    'posters:create',
    'posters:read:own',
    'posters:write:own',
    'posters:delete',
    'assets:read',
    'assets:create',
    'clients:read:own',
    'settings:read',
    'authenticated',
  ],
};

export const ROLE_HIERARCHY = {
  superadmin: 3,
  clientadmin: 2,
  user: 1,
};

/**
 * Checks whether an actor role is allowed to assign/invite a target role.
 * Escalation rule: nobody can grant a role or permission above their own,
 * and superadmin accounts can never be created via API.
 */
export function canAssignRole(actorRole, targetRole) {
  if (!actorRole || !targetRole) return false;
  if (targetRole === 'superadmin') return false; // Superadmin only via seed script
  const actorLevel = ROLE_HIERARCHY[actorRole] || 0;
  const targetLevel = ROLE_HIERARCHY[targetRole] || 0;
  return actorLevel >= targetLevel && targetLevel > 0;
}

/**
 * Returns the list of permission strings granted to a given role.
 */
export function getPermissionsForRole(role) {
  return ROLE_PERMISSIONS[role] ? [...ROLE_PERMISSIONS[role]] : [];
}

/**
 * Pure authorization check function.
 * Evaluates whether `user` has `permission`, optionally checking tenant
 * and ownership boundaries against `resource`.
 *
 * @param {object|null} user - The authenticated user object ({ id, _id, role, clientId })
 * @param {string} permission - The permission key to check
 * @param {object|null} [resource] - Target resource ({ clientId, userId, createdBy })
 * @returns {boolean}
 */
export function can(user, permission, resource = null) {
  if (!user || !user.role) return false;
  if (!permission) return false;

  const userPerms = ROLE_PERMISSIONS[user.role] || [];

  // Check base permission, including wildcard/superadmin or implied :own from :all
  let hasPerm = userPerms.includes(permission);
  if (!hasPerm && permission.endsWith(':own')) {
    const allPerm = permission.replace(/:own$/, ':all');
    if (userPerms.includes(allPerm)) {
      hasPerm = true;
    }
  }
  if (!hasPerm) return false;

  // When a resource is supplied, enforce tenant isolation and ownership rules
  if (resource) {
    // 1. Tenant boundary enforcement: resource clientId must match user clientId (except superadmin)
    if (user.role !== 'superadmin') {
      const userClientId = String(user.clientId?._id || user.clientId || '');
      const resourceClientId = String(resource.clientId?._id || resource.clientId || '');
      if (resourceClientId && userClientId !== resourceClientId) {
        return false;
      }
    }

    // 2. Ownership check: if permission is scoped to :own or is posters:delete for regular users
    const isOwnScope = permission.endsWith(':own');
    const isPosterDelete = permission === 'posters:delete';
    const hasAll =
      userPerms.includes(permission.replace(/:own$/, ':all')) ||
      (isPosterDelete && userPerms.includes('posters:write:all'));

    if ((isOwnScope || isPosterDelete) && !hasAll && user.role !== 'superadmin') {
      const resourceOwner = String(
        resource.userId?._id ||
        resource.userId ||
        resource.createdBy?._id ||
        resource.createdBy ||
        ''
      );
      const currentUserId = String(user._id || user.id || '');
      if (resourceOwner && resourceOwner !== currentUserId) {
        return false;
      }
    }
  }

  return true;
}

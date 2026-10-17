import { can, ROLE_PERMISSIONS } from '../../shared/permissions.js';

/**
 * Authoritative map of API route policies.
 * Maps 'METHOD /path' to required permission string, 'authenticated', or 'public'.
 */
export const ROUTE_POLICIES = {
  // Health
  'GET /api/health': 'public',
  'GET /health': 'public',

  // Auth - Public
  'POST /api/auth/login': 'public',
  'POST /auth/login': 'public',
  'POST /api/auth/refresh': 'public',
  'POST /auth/refresh': 'public',
  'POST /api/auth/logout': 'public',
  'POST /auth/logout': 'public',
  'POST /api/auth/forgot-password': 'public',
  'POST /auth/forgot-password': 'public',
  'POST /api/auth/reset-password': 'public',
  'POST /auth/reset-password': 'public',
  'GET /api/auth/invite/:token': 'public',
  'GET /auth/invite/:token': 'public',
  'POST /api/auth/accept-invite': 'public',
  'POST /auth/accept-invite': 'public',
  'POST /api/auth/verify-email': 'public',
  'POST /auth/verify-email': 'public',
  'POST /api/auth/confirm-email-change': 'public',
  'POST /auth/confirm-email-change': 'public',
  'POST /api/auth/mfa/verify': 'public',
  'POST /auth/mfa/verify': 'public',
  'POST /api/auth/mfa/setup': 'public',
  'POST /auth/mfa/setup': 'public',
  'POST /api/auth/mfa/confirm': 'public',
  'POST /auth/mfa/confirm': 'public',

  // Auth - Authenticated
  'POST /api/auth/logout-all': 'authenticated',
  'POST /auth/logout-all': 'authenticated',
  'GET /api/auth/me': 'authenticated',
  'GET /auth/me': 'authenticated',
  'POST /api/auth/change-password': 'authenticated',
  'POST /auth/change-password': 'authenticated',
  'POST /api/auth/send-verification': 'authenticated',
  'POST /auth/send-verification': 'authenticated',
  'POST /api/auth/request-email-change': 'authenticated',
  'POST /auth/request-email-change': 'authenticated',
  'POST /api/auth/mfa/disable': 'authenticated',
  'POST /auth/mfa/disable': 'authenticated',
  'GET /api/auth/security': 'authenticated',
  'GET /auth/security': 'authenticated',
  'GET /api/auth/sessions': 'authenticated',
  'GET /auth/sessions': 'authenticated',
  'DELETE /api/auth/sessions/:id': 'authenticated',
  'DELETE /auth/sessions/:id': 'authenticated',

  // Users
  'GET /api/users': 'users:read',
  'GET /users': 'users:read',
  'POST /api/users': 'users:create',
  'POST /users': 'users:create',
  'PATCH /api/users/:id': 'users:write',
  'PATCH /users/:id': 'users:write',
  'DELETE /api/users/:id': 'users:deactivate',
  'DELETE /users/:id': 'users:deactivate',
  'POST /api/users/:id/reset-password': 'users:write',
  'POST /users/:id/reset-password': 'users:write',
  'POST /api/users/:id/reset-mfa': 'users:write',
  'POST /users/:id/reset-mfa': 'users:write',
  'POST /api/users/invite': 'users:invite',
  'POST /users/invite': 'users:invite',
  'GET /api/users/invites': 'users:read',
  'GET /users/invites': 'users:read',
  'POST /api/users/invites/:id/resend': 'users:invite',
  'POST /users/invites/:id/resend': 'users:invite',
  'DELETE /api/users/invites/:id': 'users:deactivate',
  'DELETE /users/invites/:id': 'users:deactivate',

  // Clients
  'GET /api/clients': 'clients:manage',
  'GET /clients': 'clients:manage',
  'POST /api/clients': 'clients:manage',
  'POST /clients': 'clients:manage',
  'GET /api/clients/me': 'clients:read:own',
  'GET /clients/me': 'clients:read:own',
  'GET /api/clients/:id': 'clients:read:own',
  'GET /clients/:id': 'clients:read:own',
  'PATCH /api/clients/:id': 'settings:write',
  'PATCH /clients/:id': 'settings:write',
  'PUT /api/clients/:id': 'clients:manage',
  'PUT /clients/:id': 'clients:manage',
  'DELETE /api/clients/:id': 'clients:manage',
  'DELETE /clients/:id': 'clients:manage',

  // Brand Kit
  'GET /api/brand-kit': 'brandkit:read',
  'GET /brand-kit': 'brandkit:read',
  'PUT /api/brand-kit': 'brandkit:write',
  'PUT /brand-kit': 'brandkit:write',

  // Uploads
  'POST /api/uploads/logo': 'brandkit:write',
  'POST /uploads/logo': 'brandkit:write',
  'POST /api/uploads/image': 'posters:create',
  'POST /uploads/image': 'posters:create',
  'POST /api/uploads/brand-image/sign': 'brandkit:write',
  'POST /uploads/brand-image/sign': 'brandkit:write',

  // Templates
  'GET /api/templates': 'templates:read',
  'GET /templates': 'templates:read',
  'GET /api/templates/:id': 'templates:read',
  'GET /templates/:id': 'templates:read',
  'POST /api/templates': 'templates:write',
  'POST /templates': 'templates:write',
  'PATCH /api/templates/:id': 'templates:write',
  'PATCH /templates/:id': 'templates:write',
  'PUT /api/templates/:id/draft': 'templates:write',
  'PUT /templates/:id/draft': 'templates:write',
  'GET /api/templates/:id/draft': 'templates:write',
  'GET /templates/:id/draft': 'templates:write',
  'DELETE /api/templates/:id/draft': 'templates:write',
  'DELETE /templates/:id/draft': 'templates:write',
  'POST /api/templates/:id/duplicate': 'templates:write',
  'POST /templates/:id/duplicate': 'templates:write',
  'POST /api/templates/:id/activate': 'templates:write',
  'POST /templates/:id/activate': 'templates:write',
  'POST /api/templates/:id/deactivate': 'templates:write',
  'POST /templates/:id/deactivate': 'templates:write',
  'POST /api/templates/:id/restore': 'templates:write',
  'POST /templates/:id/restore': 'templates:write',
  'DELETE /api/templates/:id': 'templates:write',
  'DELETE /templates/:id': 'templates:write',

  // Posters
  'POST /api/posters/generate': 'posters:create',
  'POST /posters/generate': 'posters:create',
  'POST /api/posters/image': 'posters:create',
  'POST /posters/image': 'posters:create',
  'POST /api/posters/parse-list': 'posters:create',
  'POST /posters/parse-list': 'posters:create',
  'POST /api/posters': 'posters:create',
  'POST /posters': 'posters:create',
  'GET /api/posters': 'posters:read:own',
  'GET /posters': 'posters:read:own',
  'GET /api/posters/photos/search': 'posters:create',
  'GET /posters/photos/search': 'posters:create',
  'POST /api/posters/photos/download': 'posters:create',
  'POST /posters/photos/download': 'posters:create',
  'GET /api/posters/:id': 'posters:read:own',
  'GET /posters/:id': 'posters:read:own',
  'PUT /api/posters/:id/draft': 'posters:create',
  'PUT /posters/:id/draft': 'posters:create',
  'GET /api/posters/:id/draft': 'posters:read:own',
  'GET /posters/:id/draft': 'posters:read:own',
  'DELETE /api/posters/:id/draft': 'posters:create',
  'DELETE /posters/:id/draft': 'posters:create',
  'PATCH /api/posters/:id': 'posters:create',
  'PATCH /posters/:id': 'posters:create',
  'POST /api/posters/:id/versions': 'posters:create',
  'POST /posters/:id/versions': 'posters:create',
  'POST /api/posters/:id/restore': 'posters:create',
  'POST /posters/:id/restore': 'posters:create',
  'POST /api/posters/:id/duplicate': 'posters:create',
  'POST /posters/:id/duplicate': 'posters:create',
  'POST /api/posters/:id/apply-latest-design': 'posters:create',
  'POST /posters/:id/apply-latest-design': 'posters:create',
  'POST /api/posters/:id/thumbnail': 'posters:create',
  'POST /posters/:id/thumbnail': 'posters:create',
  'DELETE /api/posters/:id': 'posters:delete',
  'DELETE /posters/:id': 'posters:delete',

  // Assets
  'POST /api/assets/sign': 'assets:create',
  'POST /assets/sign': 'assets:create',
  'POST /api/assets': 'assets:create',
  'POST /assets': 'assets:create',
  'GET /api/assets': 'assets:read',
  'GET /assets': 'assets:read',
  'DELETE /api/assets/:id': 'assets:delete',
  'DELETE /assets/:id': 'assets:delete',

  // Audit
  'GET /api/audit': 'audit:read',
  'GET /audit': 'audit:read',
  'GET /api/audit/export': 'audit:read',
  'GET /audit/export': 'audit:read',
};

/**
 * Recursively inspects an Express app or router stack and returns all registered routes.
 *
 * @param {object} appOrRouter - Express application or Router instance
 * @param {string} [prefix=''] - URL mount path prefix
 * @returns {Array<{ method: string, path: string, key: string, policy: string|null }>}
 */
export function listRegisteredRoutes(appOrRouter, prefix = '') {
  const routes = [];
  const stack = appOrRouter._router?.stack || appOrRouter.stack || [];

  for (const layer of stack) {
    if (layer.route) {
      const routePath = `${prefix}${layer.route.path === '/' && prefix ? '' : layer.route.path}`;
      const methods = Object.keys(layer.route.methods || {})
        .filter((m) => layer.route.methods[m])
        .map((m) => m.toUpperCase());

      // Look for policy directly declared on route handler stack
      let declaredPolicy = null;
      for (const handler of layer.route.stack || []) {
        if (handler.handle?._permission) {
          declaredPolicy = handler.handle._permission;
          break;
        }
      }

      for (const method of methods) {
        const key = `${method} ${routePath}`;
        const policy = declaredPolicy || ROUTE_POLICIES[key] || null;
        routes.push({ method, path: routePath, key, policy });
      }
    } else if (layer.name === 'router' && layer.handle) {
      let subPrefix = prefix;
      if (layer.regexp) {
        const source = layer.regexp.source || '';
        // Extract static prefix from Express layer regexp if possible
        const match = source
          .replace('^\\', '')
          .replace('\\/?(?=\\/|$)', '')
          .replace('?(?=\\/|$)', '')
          .replace(/\\\//g, '/')
          .match(/^([/a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
          const matched = match[1].startsWith('/') ? match[1] : `/${match[1]}`;
          subPrefix = `${prefix}${matched}`;
        }
      }
      routes.push(...listRegisteredRoutes(layer.handle, subPrefix));
    }
  }

  return routes;
}

/**
 * Startup assertion: verifies that every route registered in the Express app has a known policy.
 * Throws an Error with all missing route keys if any route has no policy.
 */
export function assertAllRoutesHavePolicy(app) {
  const routes = listRegisteredRoutes(app);
  const unconfigured = [];

  for (const route of routes) {
    // Only check application API routes (skip 404 or health middleware if outside prefix)
    if (!route.policy) {
      unconfigured.push(route.key);
    }
  }

  if (unconfigured.length > 0) {
    throw new Error(
      `Startup security failure: ${unconfigured.length} registered routes have no authorization policy:\n${unconfigured.join('\n')}`
    );
  }

  return routes;
}

/**
 * Generates an authorization matrix given a list of routes or the app.
 * For each role ('superadmin', 'clientadmin', 'user', 'anonymous'), returns
 * expected access outcome (allow or deny).
 */
export function generatePermissionMatrix(routesList = Object.keys(ROUTE_POLICIES)) {
  const roles = ['superadmin', 'clientadmin', 'user', 'anonymous'];
  const matrix = [];

  for (const key of routesList) {
    const policy = typeof key === 'string' ? ROUTE_POLICIES[key] : key.policy;
    const routeKey = typeof key === 'string' ? key : key.key;

    const row = { route: routeKey, policy };
    for (const role of roles) {
      if (policy === 'public') {
        row[role] = 'allow';
      } else if (role === 'anonymous') {
        row[role] = 'deny_unauthenticated'; // Expected 401
      } else {
        const userMock = { role };
        const allowed = can(userMock, policy);
        row[role] = allowed ? 'allow' : 'deny_forbidden'; // Expected 403
      }
    }
    matrix.push(row);
  }

  return matrix;
}

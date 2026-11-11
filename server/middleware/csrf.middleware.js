import { isAllowedOrigin } from '../utils/originPolicy.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const hasCustomHeader = Boolean(req.headers['x-requested-with'] || req.headers['x-csrf-token']);
  const hasSessionCookies = Boolean(
    req.cookies?.accessToken ||
    req.cookies?.refreshToken ||
    (req.headers.cookie && (req.headers.cookie.includes('accessToken') || req.headers.cookie.includes('refreshToken')))
  );

  // If request relies on cookie credentials, the custom header is strictly required to prevent cross-site request forgery.
  if (!hasCustomHeader && hasSessionCookies) {
    return res.status(403).json({
      success: false,
      error: { message: 'CSRF protection: missing required header', status: 403 },
    });
  }

  const origin = req.headers.origin;
  if (origin && !isAllowedOrigin(origin, req)) {
    return res.status(403).json({
      success: false,
      error: { message: 'CSRF protection: untrusted origin', status: 403 },
    });
  }

  return next();
}

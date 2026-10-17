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
  if (origin) {
    const host = req.headers.host;
    let isAllowed = false;

    try {
      const originUrl = new URL(origin);
      if (originUrl.host === host) {
        isAllowed = true;
      } else if (originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1') {
        isAllowed = true;
      } else if (process.env.CLIENT_URL && originUrl.origin === new URL(process.env.CLIENT_URL).origin) {
        isAllowed = true;
      } else if (process.env.VERCEL_URL && originUrl.host === process.env.VERCEL_URL) {
        isAllowed = true;
      }
    } catch {
      isAllowed = false;
    }

    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        error: { message: 'CSRF protection: untrusted origin', status: 403 },
      });
    }
  }

  return next();
}

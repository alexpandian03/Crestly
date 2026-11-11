const DEV_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const CRESTLY_VERCEL_HOST_RE = /^crestly(?:-[a-z0-9-]+)*\.vercel\.app$/i;

function normalizeOriginEntry(rawEntry) {
  const trimmed = String(rawEntry || '').trim();
  if (!trimmed) return '';
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withScheme).origin;
  } catch {
    return '';
  }
}

function collectConfiguredOrigins() {
  const rawSources = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    process.env.CLIENT_URL,
    process.env.APP_URL,
    process.env.CORS_ORIGIN,
    process.env.CORS_ORIGINS,
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.RENDER_EXTERNAL_URL,
  ];

  const origins = new Set();
  for (const source of rawSources) {
    if (!source) continue;
    for (const part of String(source).split(',')) {
      const normalized = normalizeOriginEntry(part);
      if (normalized) origins.add(normalized);
    }
  }
  return origins;
}

/**
 * Validates whether a request Origin is allowed by CORS and CSRF origin checks.
 * Evaluates configured URLs dynamically and avoids trusting spoofable proxy headers.
 */
export function isAllowedOrigin(origin, req) {
  if (!origin) return true;

  let originUrl;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }

  const host = req?.headers?.host;
  if (host && originUrl.host === host) {
    return true;
  }

  if (DEV_HOSTNAMES.has(originUrl.hostname)) {
    return true;
  }

  if (originUrl.protocol === 'https:' && CRESTLY_VERCEL_HOST_RE.test(originUrl.hostname)) {
    return true;
  }

  return collectConfiguredOrigins().has(originUrl.origin);
}

/**
 * Open redirect prevention for login "next" parameter and post-auth navigation.
 * Only same-origin relative paths are permitted.
 */
export function sanitizeRedirect(candidate, fallback = '/') {
  if (!candidate || typeof candidate !== 'string') return fallback;

  const trimmed = candidate.trim();

  // Must begin with a single '/', cannot be protocol-relative ('//evil.com')
  // and cannot contain backslashes ('/\evil.com' or '\evil.com')
  if (
    !trimmed.startsWith('/') ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('/\\') ||
    trimmed.startsWith('\\') ||
    trimmed.includes('\\')
  ) {
    return fallback;
  }

  // Reject javascript:, data:, vbscript: or any schemes
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return fallback;
  }

  try {
    const dummy = new URL(trimmed, 'http://localhost');
    if (dummy.origin !== 'http://localhost') return fallback;
    // Prevent redirect loops to login
    if (dummy.pathname.toLowerCase().startsWith('/login')) return fallback;
    return dummy.pathname + dummy.search + dummy.hash;
  } catch {
    return fallback;
  }
}

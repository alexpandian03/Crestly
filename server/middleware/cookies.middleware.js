export function cookieParser(req, res, next) {
  req.cookies = {};
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return next();

  const pairs = cookieHeader.split(';');
  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) continue;
    const key = pair.slice(0, eqIdx).trim();
    const val = pair.slice(eqIdx + 1).trim();
    if (!key) continue;
    try {
      req.cookies[key] = decodeURIComponent(val);
    } catch {
      req.cookies[key] = val;
    }
  }
  next();
}

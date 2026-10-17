export function getCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  };
}

export function setAuthCookies(res, { accessToken, refreshToken, token, expiresAt }) {
  const options = getCookieOptions();
  const jwtToken = token || accessToken;
  if (jwtToken) {
    res.cookie('token', jwtToken, options);
    res.cookie('accessToken', jwtToken, options);
  }
  if (refreshToken) {
    const maxAge = expiresAt
      ? Math.max(0, new Date(expiresAt).getTime() - Date.now())
      : 30 * 24 * 60 * 60 * 1000;
    res.cookie('refreshToken', refreshToken, {
      ...options,
      maxAge,
    });
  }
}

export function clearAuthCookies(res) {
  const { maxAge: _maxAge, ...clearOptions } = getCookieOptions();
  res.clearCookie('token', clearOptions);
  res.clearCookie('accessToken', clearOptions);
  res.clearCookie('refreshToken', clearOptions);
}


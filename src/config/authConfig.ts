type Duration = `${number}s` | `${number}m` | `${number}h` | `${number}d`;

const authConfig = {
  // Token settings (set in env): ACCESS_TOKEN_TTL / REFRESH_TOKEN_TTL
  accessTokenTtl: (process.env['ACCESS_TOKEN_TTL'] as Duration) || '1h',
  refreshTokenTtl: (process.env['REFRESH_TOKEN_TTL'] as Duration) || '7d',
  jwtSecret: process.env['JWT_SECRET'] || 'dev-access-secret-change-me',
  jwtRefreshSecret:
    process.env['JWT_REFRESH_SECRET'] || 'dev-refresh-secret-change-me',

  // Refresh cookie settings
  refreshCookieName: process.env['REFRESH_COOKIE_NAME'] || 'rt',
  refreshCookieSecure:
    process.env['REFRESH_COOKIE_SECURE']?.toLowerCase() === 'true' ||
    process.env['NODE_ENV'] === 'production',
  refreshCookieSameSite:
    (process.env['REFRESH_COOKIE_SAMESITE'] as 'lax' | 'strict' | 'none') ||
    'lax',
  refreshCookiePath: process.env['REFRESH_COOKIE_PATH'] || '/api/auth/refresh',
};

export default authConfig;

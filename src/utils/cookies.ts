import { Response } from 'express';
import authConfig from '../config/authConfig';

const {
  refreshCookieName,
  refreshCookieSecure,
  refreshCookieSameSite,
  refreshCookiePath,
  refreshTokenTtl,
} = authConfig;

// Convert duration strings like "15m", "1h", "7d" to milliseconds
const parseDurationToMs = (duration: string): number => {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return 0;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return 0;
  }
};

export function setRefreshCookie(res: Response, token: string) {
  res.cookie(refreshCookieName, token, {
    httpOnly: true,
    secure: refreshCookieSecure,
    sameSite: refreshCookieSameSite,
    path: refreshCookiePath,
    // Persist cookie according to refresh token TTL
    maxAge: parseDurationToMs(refreshTokenTtl),
  });
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(refreshCookieName, {
    httpOnly: true,
    secure: refreshCookieSecure,
    sameSite: refreshCookieSameSite,
    path: refreshCookiePath,
  });
}

import type { CookieOptions } from 'express';

export const REFRESH_COOKIE = 'transcend_refresh';

// Only the auth endpoints receive the cookie; page scripts can never read it.
const BASE_OPTIONS: CookieOptions = { httpOnly: true, secure: true, sameSite: 'strict', path: '/api/auth' };

export function refreshCookieOptions(expiresAt: Date): CookieOptions {
  return { ...BASE_OPTIONS, expires: expiresAt };
}

export function clearedRefreshCookieOptions(): CookieOptions {
  return { ...BASE_OPTIONS };
}

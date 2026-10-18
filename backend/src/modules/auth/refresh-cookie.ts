import type { CookieOptions, Response } from 'express';

export const REFRESH_COOKIE = 'transcend_refresh';

// Only the auth endpoints receive the cookie; page scripts can never read it.
const BASE_OPTIONS: CookieOptions = { httpOnly: true, secure: true, sameSite: 'strict', path: '/api/auth' };

export function refreshCookieOptions(expiresAt: Date): CookieOptions {
  return { ...BASE_OPTIONS, expires: expiresAt };
}

export function clearedRefreshCookieOptions(): CookieOptions {
  return { ...BASE_OPTIONS };
}

// The one way any login (password, 42) hands the refresh token to the browser, so the options can't drift apart.
export function setRefreshCookie(response: Pick<Response, 'cookie'>, session: { refreshToken: string; absoluteExpiresAt: Date }): void {
  response.cookie(REFRESH_COOKIE, session.refreshToken, refreshCookieOptions(session.absoluteExpiresAt));
}

export function clearRefreshCookie(response: Pick<Response, 'clearCookie'>): void {
  response.clearCookie(REFRESH_COOKIE, clearedRefreshCookieOptions());
}

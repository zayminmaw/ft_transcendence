import type { CookieOptions, Response } from 'express';

export const REFRESH_COOKIE = 'transcend_refresh';

// Only the auth endpoints receive the cookie; page scripts can never read it. Safari drops a Secure cookie on
// http://localhost, so only development (Vite on plain http) leaves Secure off.
function baseOptions(): CookieOptions {
  return { httpOnly: true, secure: process.env.NODE_ENV !== 'development', sameSite: 'strict', path: '/api/auth' };
}

export function refreshCookieOptions(expiresAt: Date): CookieOptions {
  return { ...baseOptions(), expires: expiresAt };
}

export function clearedRefreshCookieOptions(): CookieOptions {
  return baseOptions();
}

// The one way any login (password, 42) hands the refresh token to the browser, so the options can't drift apart.
export function setRefreshCookie(response: Pick<Response, 'cookie'>, session: { refreshToken: string; absoluteExpiresAt: Date }): void {
  response.cookie(REFRESH_COOKIE, session.refreshToken, refreshCookieOptions(session.absoluteExpiresAt));
}

export function clearRefreshCookie(response: Pick<Response, 'clearCookie'>): void {
  response.clearCookie(REFRESH_COOKIE, clearedRefreshCookieOptions());
}

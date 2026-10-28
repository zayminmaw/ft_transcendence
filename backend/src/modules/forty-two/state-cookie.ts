import { randomBytes } from 'node:crypto';
import type { CookieOptions, Response } from 'express';
import { safeEqual } from '../../common/safe-equal';

export const STATE_COOKIE = 'transcend_42_state';
const STATE_TTL_MS = 10 * 60_000;

// The callback arrives as a top-level navigation from api.intra.42.fr, so the cookie must be Lax: a Strict cookie
// would stay behind. Only the 42 endpoints receive it, and the same development rule as the refresh cookie applies
// to Secure (Safari drops a Secure cookie on http://localhost).
function baseOptions(): CookieOptions {
  return { httpOnly: true, secure: process.env.NODE_ENV !== 'development', sameSite: 'lax', path: '/api/auth/42' };
}

export function newState(): string {
  return randomBytes(32).toString('base64url');
}

export function setStateCookie(response: Pick<Response, 'cookie'>, state: string): void {
  response.cookie(STATE_COOKIE, state, { ...baseOptions(), maxAge: STATE_TTL_MS });
}

export function clearStateCookie(response: Pick<Response, 'clearCookie'>): void {
  response.clearCookie(STATE_COOKIE, baseOptions());
}

// The state 42 sends back must be the one this browser was given, or another site could finish a login it started.
export function stateMatches(expected: unknown, received: unknown): boolean {
  return safeEqual(expected, received);
}

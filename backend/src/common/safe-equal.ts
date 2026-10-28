import { timingSafeEqual } from 'node:crypto';

// Constant-time string comparison for secrets (OAuth state, signed-link signatures). Anything that is not a
// non-empty string never matches.
export function safeEqual(expected: unknown, received: unknown): boolean {
  if (typeof expected !== 'string' || typeof received !== 'string' || !expected) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

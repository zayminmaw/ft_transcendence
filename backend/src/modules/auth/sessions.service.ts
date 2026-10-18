import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { UsersRepository } from '../users';
import { AuthAuditRepository } from './auth-audit.repository';
import type { RequestMeta } from './request-meta';
import { SessionsRepository } from './sessions.repository';

export const SESSION_IDLE_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1000;

export interface IssuedSession {
  userId: string;
  accessToken: string;
  refreshToken: string;
  absoluteExpiresAt: Date;
}

type RefreshOutcome =
  | { kind: 'rotated'; userId: string; refreshToken: string; absoluteExpiresAt: Date }
  | { kind: 'reused'; userId: string }
  | { kind: 'invalid' };

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function newRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

function idleExpiry(now: Date, absoluteExpiresAt: Date): Date {
  return new Date(Math.min(now.getTime() + SESSION_IDLE_MS, absoluteExpiresAt.getTime()));
}

// One place that starts, renews and ends logins. Password login and 42 login both end in start().
@Injectable()
export class SessionsService {
  constructor(
    private readonly sessions: SessionsRepository,
    private readonly users: UsersRepository,
    private readonly jwt: JwtService,
    private readonly audit: AuthAuditRepository,
  ) {}

  async start(userId: string, meta: RequestMeta, now = new Date()): Promise<IssuedSession> {
    const refreshToken = newRefreshToken();
    const absoluteExpiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_MS);
    await this.sessions.insert({
      userId,
      tokenHash: hashRefreshToken(refreshToken),
      idleExpiresAt: idleExpiry(now, absoluteExpiresAt),
      absoluteExpiresAt,
      userAgent: meta.userAgent,
      ipAddress: meta.ip,
    });
    return { userId, refreshToken, absoluteExpiresAt, accessToken: await this.jwt.signAsync({ sub: userId }) };
  }

  // Returns undefined when the token can't be used; the caller answers 401 and clears the cookie.
  async refresh(refreshToken: string, meta: RequestMeta, now = new Date()): Promise<IssuedSession | undefined> {
    const presented = hashRefreshToken(refreshToken);
    const outcome = await this.sessions.transaction<RefreshOutcome>(async (sessions) => {
      const session = await sessions.lockByTokenHash(presented);
      if (!session) return { kind: 'invalid' };
      if (session.tokenHash !== presented) {
        // The token was already swapped: someone else used it first, so the session can't be trusted.
        if (session.previousTokenHash !== presented || session.revokedAt) return { kind: 'invalid' };
        await sessions.revoke(session.id, 'reuse', now);
        return { kind: 'reused', userId: session.userId };
      }
      if (session.revokedAt || session.idleExpiresAt <= now || session.absoluteExpiresAt <= now) return { kind: 'invalid' };
      if (!(await this.users.isActive(session.userId))) {
        await sessions.revoke(session.id, 'inactive', now);
        return { kind: 'invalid' };
      }
      const next = newRefreshToken();
      await sessions.rotate(session.id, {
        tokenHash: hashRefreshToken(next),
        previousTokenHash: presented,
        lastUsedAt: now,
        idleExpiresAt: idleExpiry(now, session.absoluteExpiresAt),
      });
      return { kind: 'rotated', userId: session.userId, refreshToken: next, absoluteExpiresAt: session.absoluteExpiresAt };
    });
    if (outcome.kind === 'reused') await this.audit.record('session_reuse', outcome.userId, meta);
    if (outcome.kind !== 'rotated') return undefined;
    return { ...outcome, accessToken: await this.jwt.signAsync({ sub: outcome.userId }) };
  }

  async end(refreshToken: string, meta: RequestMeta, now = new Date()): Promise<void> {
    const session = await this.sessions.findActiveByTokenHash(hashRefreshToken(refreshToken));
    if (!session) return;
    await this.sessions.revoke(session.id, 'logout', now);
    await this.audit.record('logout', session.userId, meta);
  }
}

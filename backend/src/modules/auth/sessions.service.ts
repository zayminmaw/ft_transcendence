import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { UsersRepository } from '../users';
import { AuthAuditRepository } from './auth-audit.repository';
import type { RequestMeta } from './request-meta';
import type { UserSession } from './entities/user-session.entity';
import { SessionsRepository } from './sessions.repository';

export const SESSION_IDLE_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1000;
// Two quick reloads: the second cancels the first page's refresh, so the browser keeps the secret that refresh
// replaced. That one secret stays usable this long after it was replaced (Supabase's default); any older one, or this
// one later, means the token was copied.
export const REUSE_INTERVAL_MS = 10 * 1000;

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

// A refresh token is "<familyId>.<secret>": 16 and 32 random bytes in base64url. The family id names the session and
// never changes; the secret changes on every refresh, and only its SHA-256 is stored.
const REFRESH_TOKEN_PATTERN = /^([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})$/;

export function parseRefreshToken(token: string): { familyId: string; secret: string } | undefined {
  const match = REFRESH_TOKEN_PATTERN.exec(token);
  return match ? { familyId: match[1], secret: match[2] } : undefined;
}

export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

function randomPart(bytes: number): string {
  return randomBytes(bytes).toString('base64url');
}

function idleExpiry(now: Date, absoluteExpiresAt: Date): Date {
  return new Date(Math.min(now.getTime() + SESSION_IDLE_MS, absoluteExpiresAt.getTime()));
}

// The secret the current one replaced, presented within REUSE_INTERVAL_MS of that refresh.
function justReplaced(session: Pick<UserSession, 'previousTokenHash' | 'rotatedAt'>, hash: string, now: Date): boolean {
  return session.previousTokenHash === hash && session.rotatedAt !== null && now.getTime() - session.rotatedAt.getTime() <= REUSE_INTERVAL_MS;
}

// One place that starts, renews and ends logins. Password login and 42 login both end in start() + setRefreshCookie().
@Injectable()
export class SessionsService {
  constructor(
    private readonly sessions: SessionsRepository,
    private readonly users: UsersRepository,
    private readonly jwt: JwtService,
    private readonly audit: AuthAuditRepository,
  ) {}

  async start(userId: string, meta: RequestMeta, now = new Date()): Promise<IssuedSession> {
    const familyId = randomPart(16);
    const secret = randomPart(32);
    const absoluteExpiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_MS);
    await this.sessions.insert({
      userId,
      familyId,
      tokenHash: hashSecret(secret),
      idleExpiresAt: idleExpiry(now, absoluteExpiresAt),
      absoluteExpiresAt,
      userAgent: meta.userAgent,
      ipAddress: meta.ip,
    });
    return { userId, refreshToken: `${familyId}.${secret}`, absoluteExpiresAt, accessToken: await this.jwt.signAsync({ sub: userId }) };
  }

  // Returns undefined when the token can't be used; the caller answers 401 and clears the cookie.
  async refresh(refreshToken: string, meta: RequestMeta, now = new Date()): Promise<IssuedSession | undefined> {
    const presented = parseRefreshToken(refreshToken);
    if (!presented) return undefined;
    const outcome = await this.sessions.transaction<RefreshOutcome>(async (sessions) => {
      const session = await sessions.lockByFamilyId(presented.familyId);
      if (!session || session.revokedAt) return { kind: 'invalid' };
      const presentedHash = hashSecret(presented.secret);
      const current = session.tokenHash === presentedHash;
      if (!current && !justReplaced(session, presentedHash, now)) {
        // An older secret of this session: the token was copied and someone refreshed with it first.
        await sessions.revoke(session.id, 'reuse', now);
        return { kind: 'reused', userId: session.userId };
      }
      if (session.idleExpiresAt <= now || session.absoluteExpiresAt <= now) return { kind: 'invalid' };
      if (!(await this.users.isActive(session.userId))) {
        await sessions.revoke(session.id, 'inactive', now);
        return { kind: 'invalid' };
      }
      const next = randomPart(32);
      await sessions.rotate(session.id, {
        tokenHash: hashSecret(next),
        // The browser holds the presented secret until this answer arrives. Using the just-replaced secret again keeps
        // the time it was first replaced, so the 10 seconds never stretch.
        previousTokenHash: presentedHash,
        rotatedAt: current ? now : (session.rotatedAt ?? now),
        lastUsedAt: now,
        idleExpiresAt: idleExpiry(now, session.absoluteExpiresAt),
      });
      return { kind: 'rotated', userId: session.userId, refreshToken: `${presented.familyId}.${next}`, absoluteExpiresAt: session.absoluteExpiresAt };
    });
    if (outcome.kind === 'reused') await this.audit.record('session_reuse', outcome.userId, meta);
    if (outcome.kind !== 'rotated') return undefined;
    return { ...outcome, accessToken: await this.jwt.signAsync({ sub: outcome.userId }) };
  }

  async end(refreshToken: string, meta: RequestMeta, now = new Date()): Promise<void> {
    const presented = parseRefreshToken(refreshToken);
    if (!presented) return;
    const session = await this.sessions.findActiveByFamilyId(presented.familyId);
    if (!session) return;
    // Same rule as refresh: an older secret means the token was copied, but the one just replaced is still yours.
    const presentedHash = hashSecret(presented.secret);
    const copied = session.tokenHash !== presentedHash && !justReplaced(session, presentedHash, now);
    await this.sessions.revoke(session.id, copied ? 'reuse' : 'logout', now);
    await this.audit.record(copied ? 'session_reuse' : 'logout', session.userId, meta);
  }
}

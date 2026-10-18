import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type EntityManager, IsNull, Repository } from 'typeorm';
import { type RevokeReason, UserSession } from './entities/user-session.entity';

export interface NewSession {
  userId: string;
  familyId: string;
  tokenHash: string;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  userAgent: string | null;
  ipAddress: string | null;
}

export interface SessionRotation {
  tokenHash: string;
  lastUsedAt: Date;
  idleExpiresAt: Date;
}

// The operations a refresh needs while it holds the session row lock.
export interface SessionsTransaction {
  lockByFamilyId(familyId: string): Promise<UserSession | undefined>;
  rotate(id: string, change: SessionRotation): Promise<void>;
  revoke(id: string, reason: RevokeReason, at: Date): Promise<void>;
}

@Injectable()
export class SessionsRepository {
  constructor(@InjectRepository(UserSession) private readonly sessions: Repository<UserSession>) {}

  async insert(session: NewSession): Promise<void> {
    await this.sessions.insert(session);
  }

  async findActiveByFamilyId(familyId: string): Promise<UserSession | undefined> {
    return (await this.sessions.findOneBy({ familyId, revokedAt: IsNull() })) ?? undefined;
  }

  async revoke(id: string, reason: RevokeReason, at: Date): Promise<void> {
    await new EntitySessionsTransaction(this.sessions.manager).revoke(id, reason, at);
  }

  transaction<T>(work: (sessions: SessionsTransaction) => Promise<T>): Promise<T> {
    return this.sessions.manager.transaction((manager) => work(new EntitySessionsTransaction(manager)));
  }
}

class EntitySessionsTransaction implements SessionsTransaction {
  constructor(private readonly manager: EntityManager) {}

  // Finds the session by family id, then locks it by primary key (SELECT ... FOR UPDATE). Locking by primary key keeps
  // two refreshes of one token from deadlocking, which happened when the lock went through the token_hash unique index.
  async lockByFamilyId(familyId: string): Promise<UserSession | undefined> {
    const match = await this.manager.findOne(UserSession, { select: { id: true }, where: { familyId } });
    if (!match) return undefined;
    return (await this.manager.findOne(UserSession, { where: { id: match.id }, lock: { mode: 'pessimistic_write' } })) ?? undefined;
  }

  async rotate(id: string, change: SessionRotation): Promise<void> {
    await this.manager.update(UserSession, { id }, change);
  }

  async revoke(id: string, reason: RevokeReason, at: Date): Promise<void> {
    await this.manager.update(UserSession, { id, revokedAt: IsNull() }, { revokedAt: at, revokedReason: reason });
  }
}

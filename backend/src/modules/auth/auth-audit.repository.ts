import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { type AuditEntry, AuditService } from '../audit';
import type { RequestMeta } from './request-meta';

export type AuthAuditAction = 'login' | 'login_failed' | 'logout' | 'session_reuse' | 'password_changed' | 'profile_updated';

// What changed, for actions that change something (a profile's display name). Never a password or a token.
export interface AuthAuditValues {
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
}

// Auth's names for the shared audit trail. Logins happen before anyone is signed in, so the account is named here.
@Injectable()
export class AuthAuditRepository {
  constructor(private readonly audit: AuditService) {}

  // Never stores passwords, tokens, or the login name typed for an unknown account. Given the transaction of the change
  // it records (`manager`), the row is saved with that change or not at all.
  async record(
    action: AuthAuditAction,
    userId: string | null,
    meta: RequestMeta,
    values: AuthAuditValues = {},
    manager?: EntityManager,
  ): Promise<void> {
    const entry: AuditEntry = {
      module: 'auth',
      // In the trail, a profile change is an update of the account.
      action: action === 'profile_updated' ? 'update' : action,
      resourceType: action === 'logout' || action === 'session_reuse' ? 'session' : 'user',
      recordId: userId,
      actorId: userId,
      outcome: action === 'login_failed' ? 'failure' : 'success',
      before: values.oldValues,
      after: values.newValues,
      meta,
    };
    await (manager ? this.audit.record(manager, entry) : this.audit.recordStandalone(entry));
  }
}

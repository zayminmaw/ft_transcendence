import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit';
import type { RequestMeta } from './request-meta';

export type AuthAuditAction = 'login' | 'login_failed' | 'logout' | 'session_reuse' | 'password_changed';

// Auth's names for the shared audit trail. Logins happen before anyone is signed in, so the account is named here.
@Injectable()
export class AuthAuditRepository {
  constructor(private readonly audit: AuditService) {}

  // Never stores passwords, tokens, or the login name typed for an unknown account.
  async record(action: AuthAuditAction, userId: string | null, meta: RequestMeta): Promise<void> {
    await this.audit.recordStandalone({
      module: 'auth',
      action,
      resourceType: action === 'logout' || action === 'session_reuse' ? 'session' : 'user',
      recordId: userId,
      actorId: userId,
      outcome: action === 'login_failed' ? 'failure' : 'success',
      meta,
    });
  }
}

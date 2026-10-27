import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../audit';
import type { RequestMeta } from './request-meta';

export type AuthAuditAction = 'login' | 'login_failed' | 'logout' | 'session_reuse' | 'password_changed';

@Injectable()
export class AuthAuditRepository {
  constructor(@InjectRepository(AuditLog) private readonly auditLogs: Repository<AuditLog>) {}

  // Never stores passwords, tokens, or the login name typed for an unknown account.
  async record(action: AuthAuditAction, userId: string | null, meta: RequestMeta): Promise<void> {
    await this.auditLogs.insert({ module: 'auth', action, userId, ipAddress: meta.ip, userAgent: meta.userAgent });
  }
}

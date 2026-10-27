import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../audit';
import type { RequestMeta } from '../auth';

export type MemberAuditAction =
  | 'member_created'
  | 'member_deactivated'
  | 'member_reactivated'
  | 'member_role_changed'
  | 'password_reset';

export interface MemberAuditEntry {
  organizationId: string;
  actorId: string;
  targetId: string;
  newValues?: Record<string, unknown>;
  oldValues?: Record<string, unknown>;
}

// Who did what to whose account in which company. Never a password.
@Injectable()
export class MembersAuditRepository {
  constructor(@InjectRepository(AuditLog) private readonly auditLogs: Repository<AuditLog>) {}

  async record(action: MemberAuditAction, entry: MemberAuditEntry, meta: RequestMeta): Promise<void> {
    await this.auditLogs.insert({
      module: 'members',
      action,
      organizationId: entry.organizationId,
      userId: entry.actorId,
      recordId: entry.targetId,
      ...(entry.oldValues ? { oldValues: entry.oldValues } : {}),
      ...(entry.newValues ? { newValues: entry.newValues } : {}),
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
  }
}

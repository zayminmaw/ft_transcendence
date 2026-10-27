import { Injectable } from '@nestjs/common';
import { type AuditAction, AuditService } from '../audit';
import type { RequestMeta } from '../auth';

export type MemberAuditAction = 'member_created' | 'member_deactivated' | 'member_reactivated' | 'password_reset';

export interface MemberAuditEntry {
  organizationId: string;
  actorId: string;
  targetId: string;
  newValues?: Record<string, unknown>;
}

const ACTIONS: Record<MemberAuditAction, AuditAction> = {
  member_created: 'create',
  member_deactivated: 'status_change',
  member_reactivated: 'status_change',
  password_reset: 'password_reset',
};

// Who did what to whose account in which company, written to the shared audit trail. Never a password.
@Injectable()
export class MembersAuditRepository {
  constructor(private readonly audit: AuditService) {}

  async record(action: MemberAuditAction, entry: MemberAuditEntry, meta: RequestMeta): Promise<void> {
    const statusChange = action === 'member_deactivated' || action === 'member_reactivated';
    await this.audit.recordStandalone({
      module: 'members',
      action: ACTIONS[action],
      resourceType: 'member',
      recordId: entry.targetId,
      organizationId: entry.organizationId,
      actorId: entry.actorId,
      before: statusChange ? { isActive: action === 'member_reactivated' ? false : true } : undefined,
      after: statusChange ? { isActive: action === 'member_reactivated' } : entry.newValues,
      meta,
    });
  }
}

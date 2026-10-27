import { Injectable } from '@nestjs/common';
import { Brackets, DataSource, type SelectQueryBuilder } from 'typeorm';
import { AuditLog } from '../audit';
import { Organization } from '../organizations';
import { User } from '../users';
import { ACTIVITY_ACTIONS, ACTIVITY_COUNT_DAYS, ACTIVITY_SORT_COLUMNS } from './constants';
import { containsPattern } from './tenant-writes';
import type { ActivityCounts, ActivityDetails, ActivityEvent, ActivityListQuery } from './types/activity';

type ActivityRow = {
  id: string; createdAt: Date; action: string; tenantId: string | null; tenantName: string | null; actor: string | null;
  oldValues: unknown; newValues: unknown;
};

// Reads the platform rows of audit_logs, which the tenant and tenant administrator repositories write.
@Injectable()
export class ActivityRepository {
  constructor(private readonly database: DataSource) {}

  // Every value is a parameter, and the actions and sort come from ACTIVITY_ACTIONS and ACTIVITY_SORT_COLUMNS.
  async list(query: ActivityListQuery): Promise<{ items: ActivityEvent[]; total: number }> {
    const filtered = this.platformLogs(query.tenantId)
      .leftJoin(Organization, 'organization', 'organization.id = log.organizationId')
      .leftJoin(User, 'user', 'user.id = log.userId');
    if (query.search) {
      const pattern = containsPattern(query.search);
      filtered.andWhere(new Brackets((where) => {
        where.where('organization.name LIKE :pattern', { pattern }).orWhere('user.username LIKE :pattern', { pattern });
      }));
    }
    if (query.action !== 'all') filtered.andWhere('log.action IN (:...actions)', { actions: ACTIVITY_ACTIONS[query.action] });
    const direction = query.direction === 'desc' ? 'DESC' : 'ASC';
    const page = filtered.clone()
      .select('log.id', 'id')
      .addSelect('log.createdAt', 'createdAt')
      .addSelect('log.action', 'action')
      .addSelect('organization.id', 'tenantId')
      .addSelect('organization.name', 'tenantName')
      .addSelect('user.username', 'actor')
      .addSelect('log.oldValues', 'oldValues')
      .addSelect('log.newValues', 'newValues')
      .orderBy(ACTIVITY_SORT_COLUMNS[query.sort], direction)
      .addOrderBy('log.id', direction)
      .offset((query.page - 1) * query.pageSize)
      .limit(query.pageSize);
    const [rows, total] = await Promise.all([page.getRawMany<ActivityRow>(), filtered.getCount()]);
    return { items: rows.map(toEvent), total };
  }

  async counts(tenantId?: string): Promise<ActivityCounts> {
    const query = this.platformLogs(tenantId)
      .andWhere('log.createdAt >= NOW() - INTERVAL :days DAY', { days: ACTIVITY_COUNT_DAYS })
      .select('COUNT(*)', 'events');
    for (const [key, actions] of Object.entries(ACTIVITY_ACTIONS)) {
      query.addSelect(`COALESCE(SUM(log.action IN (:...${key})), 0)`, key).setParameter(key, actions);
    }
    const row = await query.getRawOne<Record<keyof ActivityCounts, string>>();
    return {
      events: Number(row?.events ?? 0),
      created: Number(row?.created ?? 0),
      details: Number(row?.details ?? 0),
      status: Number(row?.status ?? 0),
      administrators: Number(row?.administrators ?? 0),
    };
  }

  private platformLogs(tenantId?: string): SelectQueryBuilder<AuditLog> {
    const query = this.database.getRepository(AuditLog).createQueryBuilder('log').where('log.module = :module', { module: 'platform' });
    if (tenantId) query.andWhere('log.organizationId = :tenantId', { tenantId });
    return query;
  }
}

function toEvent(row: ActivityRow): ActivityEvent {
  return {
    id: row.id,
    createdAt: row.createdAt,
    action: row.action,
    tenant: row.tenantId && row.tenantName ? { id: row.tenantId, name: row.tenantName } : null,
    actor: row.actor,
    details: toDetails(row.action, record(row.oldValues), record(row.newValues)),
  };
}

// MariaDB stores JSON as text, so a raw select can give the string back.
function record(value: unknown): Record<string, unknown> {
  const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value;
  return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
}

const text = (value: unknown) => (typeof value === 'string' ? value : undefined);
const username = (value: unknown) => text(record(value).username);

// The shapes are the ones auditPlatformChange is given in tenant-writes.ts and the two tenant repositories.
function toDetails(action: string, before: Record<string, unknown>, after: Record<string, unknown>): ActivityDetails {
  const administrator = username(after.administrator);
  const reason = 'reason' in after ? (text(after.reason) ?? null) : undefined;
  switch (action) {
    case 'tenant.create':
      return { administrator };
    case 'tenant.update':
      return { fields: Object.keys(after) };
    case 'tenant.suspend':
    case 'tenant.reactivate':
      return { reason, administrator, cause: after.cause === 'last_administrator_revoked' ? after.cause : undefined };
    case 'tenant.administrator.assign':
      return {
        administrator,
        account: after.account === 'new' ? 'new' : 'existing',
        previousRole: text(before.role),
      };
    case 'tenant.administrator.revoke':
      return after.membershipActive === false
        ? { administrator, reason, revoke: 'remove' }
        : { administrator, reason, revoke: 'change_role', role: text(after.role) };
    default:
      return {};
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { OrganizationMember } from '../organizations/entities/organization-member.entity';
import { Role } from '../rbac/entities/role.entity';
import { User } from '../users/entities/user.entity';
import { CompanyActivityDay } from './entities/company-activity-day.entity';
import type { ActivityCounts, ChangeCounts } from './types/insights';

// Modules whose changes are not "changes made" on the dashboard. Members have their own cards, so nothing is counted
// twice. Auth, audit and insights are the system's own records, not business data.
const NOT_BUSINESS_DATA = ['members', 'auth', 'audit', 'insights'];
// The modules whose denied reads count as "denied attempts": the audit trail and the insights page itself.
const GUARDED_READS = ['audit', 'insights'];
// "Changes by module" lists only this many modules, the busiest first, so the card stays readable. The total still
// counts every module.
const TOP_MODULES = 6;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

// `from` and `to` are inclusive UTC days (YYYY-MM-DD). A day becomes explicit UTC bounds, so the database session's
// time zone cannot move an event to another day. `end` is the start of the day after `to`.
function utcWindow(from: string, to: string): { start: Date; end: Date; days: string[] } {
  if (!DAY.test(from) || !DAY.test(to) || from > to) throw new Error('A range needs two UTC days, the first not after the second.');
  const start = new Date(`${from}T00:00:00Z`);
  const last = new Date(`${to}T00:00:00Z`);
  const days: string[] = [];
  for (let time = start.getTime(); time <= last.getTime(); time += DAY_MS) days.push(new Date(time).toISOString().slice(0, 10));
  return { start, end: new Date(last.getTime() + DAY_MS), days };
}

// Aggregate columns come back as strings (bigNumberStrings), so every one goes through this.
const count = (value: unknown): number => Number(value ?? 0);

// Which members had a company open on which days. Days are UTC dates written as YYYY-MM-DD. Each write is one
// statement, so two tabs or two servers cannot race.
@Injectable()
export class InsightsRepository {
  constructor(@InjectRepository(CompanyActivityDay) private readonly days: Repository<CompanyActivityDay>) {}

  // The member had the company open that day. Creates the row with no visits; changes nothing if it exists.
  async markActive(organizationId: string, userId: string, day: string): Promise<void> {
    await this.days.query(
      'INSERT INTO company_activity_days (organization_id, user_id, day, visits) VALUES (?, ?, ?, 0) ON DUPLICATE KEY UPDATE visits = visits',
      [organizationId, userId, day],
    );
  }

  // The member opened the company again. Creates the row with one visit, or adds one.
  async addVisit(organizationId: string, userId: string, day: string): Promise<void> {
    await this.days.query(
      'INSERT INTO company_activity_days (organization_id, user_id, day, visits) VALUES (?, ?, ?, 1) ON DUPLICATE KEY UPDATE visits = visits + 1',
      [organizationId, userId, day],
    );
  }

  // Deletes every row for a day before `day`, in any company. Returns how many it deleted.
  async purgeBefore(day: string): Promise<number> {
    const result = await this.days
      .createQueryBuilder()
      .delete()
      .where('day < :day', { day })
      .execute();
    return result.affected ?? 0;
  }

  // A company's members and visits over the range. Only current active members count (active membership and active
  // account), under the role they hold now, so every number agrees with the others. Another company's rows are never
  // read: every query filters by `organizationId`.
  async activity(organizationId: string, from: string, to: string): Promise<ActivityCounts> {
    const { days } = utcWindow(from, to);
    // The activity rows of this company's current active members inside the range.
    const rows = () => this.days
      .createQueryBuilder('d')
      .innerJoin(OrganizationMember, 'm', 'm.organizationId = d.organizationId AND m.userId = d.userId AND m.isActive = true')
      .innerJoin(User, 'u', 'u.id = d.userId AND u.isActive = true')
      .innerJoin(Role, 'r', 'r.id = m.roleId')
      .where('d.organizationId = :organizationId', { organizationId })
      .andWhere('d.day BETWEEN :from AND :to', { from, to });

    const [totals, perDay, perRole, total, hasHistory] = await Promise.all([
      rows().select('COUNT(DISTINCT d.userId)', 'active').addSelect('COALESCE(SUM(d.visits), 0)', 'visits').getRawOne<{ active: string; visits: string }>(),
      rows().select("DATE_FORMAT(d.day, '%Y-%m-%d')", 'day').addSelect('COUNT(DISTINCT d.userId)', 'members').groupBy('d.day').getRawMany<{ day: string; members: string }>(),
      rows()
        .select('r.code', 'roleCode')
        .addSelect('r.name', 'roleName')
        .addSelect('COUNT(DISTINCT d.userId)', 'members')
        .groupBy('r.id')
        .addGroupBy('r.code')
        .addGroupBy('r.name')
        .orderBy('members', 'DESC')
        .addOrderBy('r.name')
        .getRawMany<{ roleCode: string; roleName: string; members: string }>(),
      // The company's current active members, whether or not they were active in the range.
      this.days.manager
        .createQueryBuilder(OrganizationMember, 'm')
        .innerJoin(User, 'u', 'u.id = m.userId AND u.isActive = true')
        .where('m.organizationId = :organizationId AND m.isActive = true', { organizationId })
        .getCount(),
      this.days.exists({ where: { organizationId } }),
    ]);
    const byDay = new Map(perDay.map((row) => [row.day, count(row.members)]));
    return {
      hasHistory,
      members: { active: count(totals?.active), total },
      visits: count(totals?.visits),
      // One entry for every day, so a day with no one still shows as zero.
      activeByDay: days.map((day) => ({ day, members: byDay.get(day) ?? 0 })),
      activeByRole: perRole.map((row) => ({ roleCode: row.roleCode, roleName: row.roleName, members: count(row.members) })),
    };
  }

  // What the company changed and a few security counts, from the audit rows it already has. Counts only, never a name
  // or a value. A failed or denied attempt is not a change, so those counts want outcome `success`.
  async changes(organizationId: string, from: string, to: string): Promise<ChangeCounts> {
    const { start, end } = utcWindow(from, to);
    // This company's audit rows inside the range.
    const rows = () => this.days.manager
      .createQueryBuilder(AuditLog, 'a')
      .where('a.organizationId = :organizationId', { organizationId })
      .andWhere('a.occurredAt >= :start AND a.occurredAt < :end', { start, end });
    // One of the member-management rows that happened, by what the members module recorded.
    const memberRows = (action: string) => rows().andWhere("a.module = 'members' AND a.action = :action AND a.outcome = 'success'", { action });

    const [modules, passwordResets, accountsSwitchedOff, roleChanges, deniedAttempts] = await Promise.all([
      rows()
        .select('a.module', 'module')
        .addSelect('COUNT(*)', 'count')
        .andWhere("a.category = 'data' AND a.action IN ('create', 'update', 'delete') AND a.outcome = 'success'")
        .andWhere('a.module NOT IN (:...excluded)', { excluded: NOT_BUSINESS_DATA })
        .groupBy('a.module')
        .orderBy('count', 'DESC')
        .addOrderBy('a.module')
        .getRawMany<{ module: string; count: string }>(),
      memberRows('password_reset').getCount(),
      // The stored values are JSON. JSON_EXTRACT keeps the text 'false', where JSON_VALUE would turn it into '0'.
      memberRows('status_change').andWhere("JSON_EXTRACT(a.newValues, '$.isActive') = 'false'").getCount(),
      // A role change is the members update that carries a role.
      memberRows('update').andWhere("JSON_VALUE(a.newValues, '$.role') IS NOT NULL").getCount(),
      rows()
        .andWhere("a.action = 'read' AND a.outcome = 'denied' AND a.module IN (:...guarded)", { guarded: GUARDED_READS })
        .getCount(),
    ]);
    return {
      changes: {
        total: modules.reduce((sum, row) => sum + count(row.count), 0),
        byModule: modules.slice(0, TOP_MODULES).map((row) => ({ module: row.module, count: count(row.count) })),
      },
      security: { passwordResets, accountsSwitchedOff, roleChanges, deniedAttempts },
    };
  }
}

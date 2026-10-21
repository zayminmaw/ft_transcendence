import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, type EntityManager, type ObjectLiteral, Repository, type SelectQueryBuilder } from 'typeorm';
import { AuditLog } from '../audit';
import { Organization, OrganizationMember } from '../organizations';
import { Role } from '../rbac';
import { User } from '../users';
import { SORT_COLUMNS } from './constants';
import type {
  CreateTenantResult, NewTenant, PlatformActor, TenantAdministrator, TenantChanges, TenantCounts, TenantListItem, TenantListQuery,
  TenantMembership,
} from './types/tenant';

export const TENANT_ADMIN_ROLE = 'org_admin';

@Injectable()
export class TenantsRepository {
  constructor(
    private readonly database: DataSource,
    @InjectRepository(Organization) private readonly organizations: Repository<Organization>,
  ) {}

  // Every value is a parameter and the sort comes from SORT_COLUMNS.
  async list(query: TenantListQuery): Promise<{ items: TenantListItem[]; total: number }> {
    const filtered = this.organizations.createQueryBuilder('organization');
    if (query.search) {
      const pattern = `%${query.search.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
      filtered.andWhere(new Brackets((where) => {
        where.where('organization.name LIKE :pattern', { pattern }).orWhere('organization.slug LIKE :pattern', { pattern });
      }));
    }
    if (query.status !== 'all') filtered.andWhere('organization.isActive = :isActive', { isActive: query.status === 'active' });
    const direction = query.direction === 'desc' ? 'DESC' : 'ASC';
    const page = filtered.clone()
      .select('organization.id', 'id')
      .addSelect('organization.name', 'name')
      .addSelect('organization.slug', 'slug')
      .addSelect('organization.isActive', 'isActive')
      .addSelect('organization.createdAt', 'createdAt')
      .addSelect((first) => this.firstAdministrator(first), 'administrator')
      .addSelect((count) => this.activeMembers(count), 'activeMembers')
      .orderBy(SORT_COLUMNS[query.sort], direction)
      .addOrderBy('organization.id', direction)
      .offset((query.page - 1) * query.pageSize)
      .limit(query.pageSize);
    const [rows, total] = await Promise.all([
      page.getRawMany<{ id: string; name: string; slug: string; isActive: number; createdAt: Date; administrator: string | null; activeMembers: string }>(),
      filtered.getCount(),
    ]);
    return {
      items: rows.map((row) => ({ ...row, isActive: Boolean(row.isActive), activeMembers: Number(row.activeMembers) })),
      total,
    };
  }

  async counts(): Promise<TenantCounts> {
    const [total, active] = await Promise.all([this.organizations.count(), this.organizations.countBy({ isActive: true })]);
    return { total, active, suspended: total - active };
  }

  async findById(id: string): Promise<Organization | undefined> {
    return (await this.organizations.findOneBy({ id })) ?? undefined;
  }

  async findAdministrators(organizationId: string): Promise<TenantAdministrator[]> {
    const rows = await this.administrators(this.database.createQueryBuilder())
      .andWhere('member.organizationId = :organizationId', { organizationId })
      .select('user.id', 'id')
      .addSelect('user.username', 'username')
      .addSelect('user.email', 'email')
      .addSelect('user.isActive', 'accountActive')
      .addSelect('member.joinedAt', 'joinedAt')
      .getRawMany<{ id: string; username: string; email: string; accountActive: number; joinedAt: Date }>();
    return rows.map((row) => ({ ...row, accountActive: Boolean(row.accountActive) }));
  }

  async findMembership(organizationId: string): Promise<TenantMembership> {
    const row = await this.database.createQueryBuilder()
      .select('COUNT(*)', 'members')
      .addSelect('SUM(member.isActive = TRUE AND user.isActive = TRUE)', 'activeMembers')
      .from(OrganizationMember, 'member')
      .innerJoin(User, 'user', 'user.id = member.userId')
      .where('member.organizationId = :organizationId', { organizationId })
      .getRawOne<{ members: string; activeMembers: string | null }>();
    return { members: Number(row?.members ?? 0), activeMembers: Number(row?.activeMembers ?? 0) };
  }

  // The company, its first administrator account and their org_admin membership commit together or not at all.
  // The checks give a clear answer for the usual duplicate; the unique keys still stop two requests racing.
  create(tenant: NewTenant, actor: PlatformActor): Promise<CreateTenantResult> {
    return this.database.transaction(async (manager) => {
      const { organization: details, administrator: account } = tenant;
      if (await manager.existsBy(Organization, { slug: details.slug })) return { created: false, conflict: 'slug' };
      if (await manager.existsBy(User, { username: account.username })) return { created: false, conflict: 'username' };
      if (await manager.existsBy(User, { email: account.email })) return { created: false, conflict: 'email' };
      const role = await manager.findOneBy(Role, { code: TENANT_ADMIN_ROLE });
      if (!role) throw new Error('The org_admin role is missing. Run the migrations first.');
      const organization = await manager.save(manager.create(Organization, details));
      const administrator = await manager.save(manager.create(User, account));
      await manager.insert(OrganizationMember, { organizationId: organization.id, userId: administrator.id, roleId: role.id });
      await this.audit(manager, actor, organization.id, 'tenant.create', undefined, {
        ...details,
        administrator: { id: administrator.id, username: administrator.username, email: administrator.email },
      });
      return { created: true, organization, administrator };
    });
  }

  // Saves only the details that differ and audits them; undefined when the company does not exist.
  update(id: string, changes: TenantChanges, actor: PlatformActor): Promise<Organization | undefined> {
    return this.database.transaction(async (manager) => {
      const organization = await manager.findOne(Organization, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!organization) return undefined;
      const before: TenantChanges = {};
      const after: TenantChanges = {};
      for (const key of Object.keys(changes) as (keyof TenantChanges)[]) {
        if (changes[key] === undefined || changes[key] === organization[key]) continue;
        Object.assign(before, { [key]: organization[key] });
        Object.assign(after, { [key]: changes[key] });
      }
      if (Object.keys(after).length === 0) return organization;
      Object.assign(organization, after);
      const saved = await manager.save(organization);
      await this.audit(manager, actor, id, 'tenant.update', before, after);
      return saved;
    });
  }

  // Suspending only flips is_active: memberships, parcels and ledgers stay, and every tenant request already
  // requires an active company. The update only matches a company that still has the other status, so two admins
  // racing can't both change it. Undefined when nothing changed: no such company, or it already had that status.
  setActive(id: string, isActive: boolean, reason: string | null, actor: PlatformActor): Promise<Organization | undefined> {
    return this.database.transaction(async (manager) => {
      const { affected } = await manager.update(Organization, { id, isActive: !isActive }, { isActive });
      if (!affected) return undefined;
      await this.audit(manager, actor, id, isActive ? 'tenant.reactivate' : 'tenant.suspend', { isActive: !isActive }, { isActive, reason });
      return manager.findOneByOrFail(Organization, { id });
    });
  }

  // Written in the same transaction as the change, so a change is never saved without its audit row.
  private async audit(
    manager: EntityManager, actor: PlatformActor, organizationId: string, action: string,
    oldValues: object | undefined, newValues: object,
  ) {
    await manager.insert(AuditLog, {
      module: 'platform', action, organizationId, recordId: organizationId, userId: actor.userId,
      ipAddress: actor.ip, userAgent: actor.userAgent, oldValues, newValues,
    });
  }

  // Active administrator memberships with their accounts, earliest first.
  private administrators(builder: SelectQueryBuilder<ObjectLiteral>) {
    return builder
      .from(OrganizationMember, 'member')
      .innerJoin(User, 'user', 'user.id = member.userId')
      .innerJoin(Role, 'role', 'role.id = member.roleId')
      .where('member.isActive = TRUE')
      .andWhere('role.code = :adminRole', { adminRole: TENANT_ADMIN_ROLE })
      .orderBy('member.joinedAt')
      .addOrderBy('member.id');
  }

  // The list's administrator column: the earliest active administrator of each row's company.
  private firstAdministrator(builder: SelectQueryBuilder<ObjectLiteral>) {
    return this.administrators(builder).select('user.username').andWhere('member.organizationId = organization.id').limit(1);
  }

  // Active members: an active membership of an active account.
  private activeMembers(builder: SelectQueryBuilder<ObjectLiteral>) {
    return builder
      .select('COUNT(*)')
      .from(OrganizationMember, 'member')
      .innerJoin(User, 'user', 'user.id = member.userId')
      .where('member.organizationId = organization.id')
      .andWhere('member.isActive = TRUE')
      .andWhere('user.isActive = TRUE');
  }
}

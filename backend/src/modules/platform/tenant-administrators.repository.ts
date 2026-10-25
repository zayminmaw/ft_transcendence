import { Injectable } from '@nestjs/common';
import { Brackets, DataSource, EntityManager, In, Not } from 'typeorm';
import { OrganizationMember } from '../organizations';
import { Role } from '../rbac';
import { User } from '../users';
import { CANDIDATE_LIMIT, NON_MEMBER_ROLES, TENANT_ADMIN_ROLE } from './constants';
import {
  accountConflict, auditPlatformChange, changeTenantStatus, containsPattern, countUsableAdministrators, findRole, insertAdministrator,
  lockTenant,
} from './tenant-writes';
import type {
  AssignAdministrator, AssignAdministratorResult, MemberRole, PlatformActor, RevokeAdministrator, RevokeAdministratorResult,
  TenantMember,
} from './types/tenant';

// Assigning and revoking tenant administrators. Each change holds the company lock (see lockTenant) and is audited in
// the same transaction. A membership is one role in one company, so assigning and revoking change that role.
@Injectable()
export class TenantAdministratorsRepository {
  constructor(private readonly database: DataSource) {}

  // Members who could become administrators: current members by username, then removed ones.
  async findCandidates(organizationId: string, search?: string): Promise<TenantMember[]> {
    const query = this.database.createQueryBuilder()
      .from(OrganizationMember, 'member')
      .innerJoin(User, 'user', 'user.id = member.userId')
      .innerJoin(Role, 'role', 'role.id = member.roleId')
      .where('member.organizationId = :organizationId', { organizationId })
      .andWhere('user.isActive = TRUE')
      .andWhere('NOT (member.isActive = TRUE AND role.code = :adminRole)', { adminRole: TENANT_ADMIN_ROLE });
    if (search) {
      const pattern = containsPattern(search);
      query.andWhere(new Brackets((where) => {
        where.where('user.username LIKE :pattern', { pattern }).orWhere('user.email LIKE :pattern', { pattern });
      }));
    }
    const rows = await query
      .select('user.id', 'id')
      .addSelect('user.username', 'username')
      .addSelect('user.email', 'email')
      .addSelect('role.code', 'roleCode')
      .addSelect('role.name', 'roleName')
      .addSelect('member.isActive', 'isActive')
      .orderBy('member.isActive', 'DESC')
      .addOrderBy('user.username')
      .limit(CANDIDATE_LIMIT)
      .getRawMany<{ id: string; username: string; email: string; roleCode: string; roleName: string; isActive: number | boolean }>();
    return rows.map(({ roleCode, roleName, isActive, ...member }) => ({
      ...member, role: { code: roleCode, name: roleName }, removed: !isActive,
    }));
  }

  // Roles are shared by every company today, so this is every role but org_admin and platform_admin. Company-made
  // roles would narrow it (and findMemberRole) by company.
  async findMemberRoles(): Promise<MemberRole[]> {
    const roles = await this.database.getRepository(Role).find({ where: { code: Not(In(NON_MEMBER_ROLES)) }, order: { id: 'ASC' } });
    return roles.map(({ code, name, description }) => ({ code, name, description }));
  }

  // A new account, or an existing member whose role becomes org_admin. A removed member is brought back, since their
  // account still exists and only the membership was turned off. Allowed while the company is suspended, so it can get
  // an administrator before it is reactivated.
  assign(organizationId: string, request: AssignAdministrator, actor: PlatformActor): Promise<AssignAdministratorResult> {
    return this.database.transaction(async (manager) => {
      if (!(await lockTenant(manager, organizationId))) return { done: false, problem: 'tenant_not_found' };
      if (request.mode === 'new') {
        const conflict = await accountConflict(manager, request.account);
        if (conflict) return { done: false, problem: conflict };
        const { id, username, email } = await insertAdministrator(manager, organizationId, request.account);
        await auditPlatformChange(manager, actor, organizationId, 'tenant.administrator.assign', undefined, {
          administrator: { id, username, email }, account: 'new', role: TENANT_ADMIN_ROLE,
        });
        return { done: true, administrator: { id, username, email } };
      }

      const member = await manager.createQueryBuilder()
        .from(OrganizationMember, 'member')
        .innerJoin(User, 'user', 'user.id = member.userId')
        .innerJoin(Role, 'role', 'role.id = member.roleId')
        .where('member.organizationId = :organizationId', { organizationId })
        .andWhere('member.userId = :userId', { userId: request.userId })
        .andWhere('user.isActive = TRUE')
        .select('member.id', 'membershipId')
        .addSelect('user.id', 'id')
        .addSelect('user.username', 'username')
        .addSelect('user.email', 'email')
        .addSelect('role.code', 'roleCode')
        .addSelect('member.isActive', 'isActive')
        .getRawOne<{ membershipId: string; id: string; username: string; email: string; roleCode: string; isActive: number | boolean }>();
      if (!member) return { done: false, problem: 'member_not_found' };
      if (member.isActive && member.roleCode === TENANT_ADMIN_ROLE) return { done: false, problem: 'already_administrator' };
      const role = await findRole(manager, TENANT_ADMIN_ROLE);
      await manager.update(OrganizationMember, { id: member.membershipId }, { roleId: role.id, isActive: true });
      const { id, username, email } = member;
      await auditPlatformChange(
        manager, actor, organizationId, 'tenant.administrator.assign',
        { administrator: { id, username }, role: member.roleCode, membershipActive: Boolean(member.isActive) },
        { administrator: { id, username }, account: 'existing', role: TENANT_ADMIN_ROLE, membershipActive: true },
      );
      return { done: true, administrator: { id, username, email } };
    });
  }

  // The caller chooses the outcome, and it must match the company: suspend_tenant for its last usable administrator,
  // change_role or remove otherwise. A mismatch means the page was out of date, so nothing changes and the caller is
  // told why rather than getting a result it never chose.
  revoke(organizationId: string, userId: string, request: RevokeAdministrator, actor: PlatformActor): Promise<RevokeAdministratorResult> {
    return this.database.transaction(async (manager) => {
      const organization = await lockTenant(manager, organizationId);
      if (!organization) return { done: false, problem: 'tenant_not_found' };
      const adminRole = await findRole(manager, TENANT_ADMIN_ROLE);
      const membership = await manager.findOneBy(OrganizationMember, { organizationId, userId, isActive: true, roleId: adminRole.id });
      if (!membership) return { done: false, problem: 'administrator_not_found' };
      const last = (await countUsableAdministrators(manager, organizationId, userId)) === 0;
      if (last && request.outcome !== 'suspend_tenant') return { done: false, problem: 'last_administrator' };
      if (!last && request.outcome === 'suspend_tenant') return { done: false, problem: 'not_last_administrator' };

      const { username } = await manager.findOneByOrFail(User, { id: userId });
      const administrator = { id: userId, username };
      if (request.outcome === 'change_role') {
        const role = await findMemberRole(manager, request.roleCode);
        if (!role) return { done: false, problem: 'role_not_available' };
        await manager.update(OrganizationMember, { id: membership.id }, { roleId: role.id });
        await auditPlatformChange(
          manager, actor, organizationId, 'tenant.administrator.revoke', { administrator, role: TENANT_ADMIN_ROLE },
          { administrator, role: role.code, reason: request.reason },
        );
        return { done: true, tenantSuspended: false };
      }

      // The membership keeps its org_admin role but no longer counts anywhere: every check needs an active one.
      await manager.update(OrganizationMember, { id: membership.id }, { isActive: false });
      await auditPlatformChange(
        manager, actor, organizationId, 'tenant.administrator.revoke', { administrator, role: TENANT_ADMIN_ROLE, membershipActive: true },
        { administrator, membershipActive: false, reason: request.reason },
      );
      if (request.outcome === 'remove' || !organization.isActive) return { done: true, tenantSuspended: false };
      await changeTenantStatus(manager, actor, organization, false, request.reason, { cause: 'last_administrator_revoked', administrator });
      return { done: true, tenantSuspended: true };
    });
  }
}

// One of the roles findMemberRoles offers, or nothing.
async function findMemberRole(manager: EntityManager, code: string): Promise<Role | null> {
  if (NON_MEMBER_ROLES.includes(code)) return null;
  return manager.findOneBy(Role, { code });
}

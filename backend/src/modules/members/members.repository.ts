import { Injectable } from '@nestjs/common';
import { DataSource, Not } from 'typeorm';
import { OrganizationMember } from '../organizations';
import { PLATFORM_ADMIN_ROLE, Role, RolePermission, UserRole } from '../rbac';
import { createAccount, User } from '../users';

export interface Member {
  userId: string;
  username: string;
  email: string;
  displayName: string | null;
  role: { id: number; code: string; name: string };
  isActive: boolean;
  lastLoginAt: Date | null;
  mustChangePassword: boolean;
}

export interface CompanyRole {
  id: number;
  code: string;
  name: string;
  description: string | null;
}

// One role for the Roles & permissions view: what it allows and how many people hold it in this company.
export interface RoleOverview {
  code: string;
  name: string;
  members: number;
  permissions: { code: string; scope: 'all' | 'assigned_only' }[];
}

export interface NewMember {
  username: string;
  email: string;
  password: string;
  roleId: number;
}

interface MemberRow {
  userId: string;
  username: string;
  email: string;
  displayName: string | null;
  roleId: number;
  roleCode: string;
  roleName: string;
  isActive: number | boolean;
  lastLoginAt: Date | null;
  mustChangePassword: number | boolean;
}

// The people of one company: their account, role and membership. Every people query is scoped to the company;
// roles are shared by every company.
@Injectable()
export class MembersRepository {
  constructor(private readonly database: DataSource) {}

  // The roles a member may be given: every company role, never platform_admin; sorted by name for the dropdown.
  async companyRoles(): Promise<CompanyRole[]> {
    const roles = await this.database.getRepository(Role).find({ where: { code: Not(PLATFORM_ADMIN_ROLE) }, order: { name: 'ASC' } });
    return roles.map(({ id, code, name, description }) => ({ id, code, name, description }));
  }

  // Every company role (never platform_admin) in the seed's order, its permissions in the docs' order, and how many
  // people hold it here, switched off or not. Roles are shared by every company; only the counts are this company's.
  async roleOverview(organizationId: string): Promise<RoleOverview[]> {
    const roles = await this.database.getRepository(Role).find({ where: { code: Not(PLATFORM_ADMIN_ROLE) }, order: { id: 'ASC' } });
    const grants = await this.database.getRepository(RolePermission).find({
      relations: { permission: true },
      order: { permission: { id: 'ASC' } },
    });
    const counts = await this.database
      .createQueryBuilder(OrganizationMember, 'm')
      .select('m.roleId', 'roleId')
      .addSelect('COUNT(*)', 'total')
      .where('m.organizationId = :organizationId', { organizationId })
      .groupBy('m.roleId')
      .getRawMany<{ roleId: number; total: number | string }>();
    return roles.map((role) => ({
      code: role.code,
      name: role.name,
      members: Number(counts.find((row) => Number(row.roleId) === role.id)?.total ?? 0),
      permissions: grants
        .filter((grant) => grant.roleId === role.id)
        .map(({ permission, scope }) => ({ code: permission.code, scope })),
    }));
  }

  list(organizationId: string): Promise<Member[]> {
    return this.query(organizationId);
  }

  async find(organizationId: string, userId: string): Promise<Member | undefined> {
    return (await this.query(organizationId, userId))[0];
  }

  // A new account that must change its password, and its active membership, in one transaction.
  async create(organizationId: string, input: NewMember): Promise<Member> {
    const userId = await this.database.transaction(async (manager) => {
      const id = await createAccount(manager, {
        username: input.username,
        email: input.email,
        password: input.password,
        mustChangePassword: true,
      });
      await manager.insert(OrganizationMember, { organizationId, userId: id, roleId: input.roleId, isActive: true });
      return id;
    });
    const member = await this.find(organizationId, userId);
    if (!member) throw new Error('The new member could not be read back.');
    return member;
  }

  async setActive(organizationId: string, userId: string, isActive: boolean): Promise<void> {
    await this.database.getRepository(OrganizationMember).update({ organizationId, userId }, { isActive });
  }

  async setRole(organizationId: string, userId: string, roleId: number): Promise<void> {
    await this.database.getRepository(OrganizationMember).update({ organizationId, userId }, { roleId });
  }

  // True when the account also belongs to another company (active or not) or has a platform role: a company admin
  // must not be able to reset its password.
  async belongsElsewhere(organizationId: string, userId: string): Promise<boolean> {
    const [otherCompany, platformRole] = await Promise.all([
      this.database.getRepository(OrganizationMember).existsBy({ userId, organizationId: Not(organizationId) }),
      this.database.getRepository(UserRole).existsBy({ userId }),
    ]);
    return otherCompany || platformRole;
  }

  private async query(organizationId: string, userId?: string): Promise<Member[]> {
    const query = this.database
      .createQueryBuilder(OrganizationMember, 'm')
      .innerJoin(User, 'u', 'u.id = m.userId')
      .innerJoin(Role, 'r', 'r.id = m.roleId')
      .select('u.id', 'userId')
      .addSelect('u.username', 'username')
      .addSelect('u.email', 'email')
      .addSelect('u.displayName', 'displayName')
      .addSelect('r.id', 'roleId')
      .addSelect('r.code', 'roleCode')
      .addSelect('r.name', 'roleName')
      .addSelect('m.isActive', 'isActive')
      .addSelect('u.lastLoginAt', 'lastLoginAt')
      .addSelect('u.mustChangePassword', 'mustChangePassword')
      .where('m.organizationId = :organizationId', { organizationId })
      .orderBy('u.username', 'ASC');
    if (userId) query.andWhere('m.userId = :userId', { userId });
    const rows = await query.getRawMany<MemberRow>();
    return rows.map((row) => ({
      userId: String(row.userId),
      username: row.username,
      email: row.email,
      displayName: row.displayName,
      role: { id: Number(row.roleId), code: row.roleCode, name: row.roleName },
      isActive: Boolean(Number(row.isActive)),
      lastLoginAt: row.lastLoginAt,
      mustChangePassword: Boolean(Number(row.mustChangePassword)),
    }));
  }
}

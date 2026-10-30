import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { TenantContext } from '../../common/types/authenticated-request';
import { type RequestMeta, SessionsService } from '../auth';
import { AccountError, hashPassword, temporaryPassword, UsersRepository } from '../users';
import type { CreateMemberDto } from './dto/create-member.dto';
import { MembersAuditRepository } from './members-audit.repository';
import { type Member, MembersRepository } from './members.repository';

const NOT_FOUND = { message: "That person isn't in this company.", code: 'MEMBER_NOT_FOUND' };
const ROLE_NOT_ASSIGNABLE = { message: "You can't give this role.", code: 'ROLE_NOT_ASSIGNABLE' };
const SELF = { message: "You can't do this to your own account. Use Change password instead.", code: 'MEMBER_SELF' };
// For an account used outside this company: one neutral answer, so it never reveals the other company.
const NOT_ALLOWED = { message: "You can't do this for this person.", code: 'MEMBER_NOT_ALLOWED' };
const ACCOUNT_CODES = { username: 'INVALID_USERNAME', email: 'INVALID_EMAIL', password: 'PASSWORD_RULE' } as const;

export function publicMember(member: Member) {
  const { userId, username, email, role, isActive, lastLoginAt, mustChangePassword } = member;
  return { userId, username, email, role: { code: role.code, name: role.name }, isActive, lastLoginAt, mustChangePassword };
}

// "People & access": company admins (admin.manage_users) run their own people. The company always comes from the
// verified tenant context, never from the request body.
@Injectable()
export class MembersService {
  constructor(
    private readonly members: MembersRepository,
    private readonly users: UsersRepository,
    private readonly sessions: SessionsService,
    private readonly audit: MembersAuditRepository,
  ) {}

  async list(tenant: TenantContext) {
    return (await this.members.list(tenant.organizationId)).map(publicMember);
  }

  async assignableRoles() {
    return (await this.members.companyRoles()).map(({ code, name, description }) => ({ code, name, description }));
  }

  roleOverview(tenant: TenantContext) {
    return this.members.roleOverview(tenant.organizationId);
  }

  async create(tenant: TenantContext, actorId: string, input: CreateMemberDto, meta: RequestMeta) {
    const role = (await this.members.companyRoles()).find(({ code }) => code === input.roleCode);
    if (!role) throw new ForbiddenException(ROLE_NOT_ASSIGNABLE);
    let member: Member;
    try {
      member = await this.members.create(tenant.organizationId, { ...input, roleId: role.id });
    } catch (error) {
      if (!(error instanceof AccountError)) throw error;
      if (error.problem === 'taken') throw new ConflictException({ message: error.message, code: 'MEMBER_TAKEN' });
      throw new BadRequestException({ message: error.message, code: ACCOUNT_CODES[error.problem] });
    }
    await this.audit.record('member_created', this.entry(tenant, actorId, member, { role: role.code }), meta);
    return publicMember(member);
  }

  // Their access to this company ends on the next request (the guard checks membership every time); other companies
  // and sessions are untouched. Asking for the current state again changes nothing.
  async setActive(tenant: TenantContext, actorId: string, userId: string, isActive: boolean, meta: RequestMeta) {
    const member = await this.requireTarget(tenant, actorId, userId);
    if (member.isActive === isActive) return publicMember(member);
    await this.members.setActive(tenant.organizationId, member.userId, isActive);
    await this.audit.record(isActive ? 'member_reactivated' : 'member_deactivated', this.entry(tenant, actorId, member), meta);
    return publicMember({ ...member, isActive });
  }

  // Another role in this company, from the person's next request (the guard reads the membership every time). A role
  // belongs to one membership, so people who also work elsewhere can change too. The current role again changes
  // nothing.
  async changeRole(tenant: TenantContext, actorId: string, userId: string, roleCode: string, meta: RequestMeta) {
    const member = await this.requireTarget(tenant, actorId, userId);
    const role = (await this.members.companyRoles()).find(({ code }) => code === roleCode);
    if (!role) throw new ForbiddenException(ROLE_NOT_ASSIGNABLE);
    if (member.role.code === role.code) return publicMember(member);
    await this.members.setRole(tenant.organizationId, member.userId, role.id);
    const entry = this.entry(tenant, actorId, member, { role: role.code }, { role: member.role.code });
    await this.audit.record('member_role_changed', entry, meta);
    return publicMember({ ...member, role: { id: role.id, code: role.code, name: role.name } });
  }

  // A forgotten password: a one-time password generated here and shown once. The person must replace it at the next
  // login, and all their sessions end. Only for accounts that belong to this company alone.
  async resetPassword(tenant: TenantContext, actorId: string, userId: string, meta: RequestMeta) {
    const member = await this.requireTarget(tenant, actorId, userId);
    if (await this.members.belongsElsewhere(tenant.organizationId, member.userId)) throw new ForbiddenException(NOT_ALLOWED);
    const password = temporaryPassword();
    await this.users.updatePassword(member.userId, await hashPassword(password), true);
    await this.sessions.endAll(member.userId, 'password_reset');
    await this.audit.record('password_reset', this.entry(tenant, actorId, member), meta);
    return { temporaryPassword: password };
  }

  // Someone in this company who isn't you. No "admin powers you lack" check yet: only org_admin can manage users
  // and it holds every admin permission (waiyan, 2026-10-22; the roles task adds it if that changes).
  private async requireTarget(tenant: TenantContext, actorId: string, userId: string): Promise<Member> {
    const member = /^[1-9]\d*$/.test(userId) ? await this.members.find(tenant.organizationId, userId) : undefined;
    if (!member) throw new NotFoundException(NOT_FOUND);
    if (member.userId === actorId) throw new ForbiddenException(SELF);
    return member;
  }

  private entry(
    tenant: TenantContext,
    actorId: string,
    target: Member,
    newValues?: Record<string, unknown>,
    oldValues?: Record<string, unknown>,
  ) {
    const { userId: targetId, username: targetName } = target;
    return { organizationId: tenant.organizationId, actorId, targetId, targetName, newValues, ...(oldValues ? { oldValues } : {}) };
  }
}

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PresenceService } from '../notifications';
import { hashPassword, passwordProblems } from '../users/password';
import { PASSWORD_RULE } from '../users/account-rules';
import { ADMINISTRATOR_PROBLEMS, TENANT_CONFLICTS, TENANT_NOT_FOUND } from './constants';
import type { AssignAdministratorDto, RevokeAdministratorDto } from './dto/tenant.dto';
import { TenantAdministratorsRepository } from './tenant-administrators.repository';
import { TenantsRepository } from './tenants.repository';
import type { AssignAdministrator, PlatformActor, RevokeAdministrator } from './types/tenant';

@Injectable()
export class TenantAdministratorsService {
  constructor(
    private readonly administrators: TenantAdministratorsRepository,
    private readonly tenants: TenantsRepository,
    private readonly presence: PresenceService,
  ) {}

  async findCandidates(organizationId: string, search?: string) {
    if (!(await this.tenants.findById(organizationId))) throw new NotFoundException(TENANT_NOT_FOUND);
    return this.administrators.findCandidates(organizationId, search);
  }

  async findMemberRoles(organizationId: string) {
    if (!(await this.tenants.findById(organizationId))) throw new NotFoundException(TENANT_NOT_FOUND);
    return this.administrators.findMemberRoles();
  }

  // The answer names the administrator, never the password.
  async assign(organizationId: string, body: AssignAdministratorDto, actor: PlatformActor) {
    let request: AssignAdministrator;
    if (body.mode === 'new') {
      const { username, email, password } = body.account!;
      if (passwordProblems(password).length > 0) throw new BadRequestException({ message: PASSWORD_RULE, code: 'PASSWORD_TOO_WEAK' });
      request = { mode: 'new', account: { username, email, passwordHash: await hashPassword(password) } };
    } else {
      request = { mode: 'existing', userId: body.userId! };
    }
    const result = await this.administrators.assign(organizationId, request, actor);
    if (result.done) return { administrator: result.administrator };
    if (result.problem === 'tenant_not_found') throw new NotFoundException(TENANT_NOT_FOUND);
    if (result.problem === 'member_not_found') throw new NotFoundException(ADMINISTRATOR_PROBLEMS.member_not_found);
    if (result.problem === 'already_administrator') throw new ConflictException(ADMINISTRATOR_PROBLEMS.already_administrator);
    throw new ConflictException(TENANT_CONFLICTS[result.problem]);
  }

  async revoke(organizationId: string, userId: string, body: RevokeAdministratorDto, actor: PlatformActor) {
    const { outcome, reason } = body;
    const request: RevokeAdministrator = outcome === 'change_role' ? { outcome, roleCode: body.roleCode!, reason } : { outcome, reason };
    const result = await this.administrators.revoke(organizationId, userId, request, actor);
    if (result.done) {
      // After the transaction has committed. A suspended company loses every connection; otherwise the removed person's
      // status is recomputed. Moving them to another role keeps the membership, so nothing changes for their contacts.
      if (result.tenantSuspended) await this.presence.closeCompany(organizationId);
      else if (outcome !== 'change_role') await this.presence.refresh(organizationId, userId);
      return { tenantSuspended: result.tenantSuspended };
    }
    if (result.problem === 'tenant_not_found') throw new NotFoundException(TENANT_NOT_FOUND);
    if (result.problem === 'administrator_not_found') throw new NotFoundException(ADMINISTRATOR_PROBLEMS.administrator_not_found);
    throw new ConflictException(ADMINISTRATOR_PROBLEMS[result.problem]);
  }
}

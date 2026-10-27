import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { hashPassword, passwordProblems } from '../users/password';
import type { Organization } from '../organizations';
import { PASSWORD_RULE } from '../users/account-rules';
import { TENANT_ALREADY_ACTIVE, TENANT_ALREADY_SUSPENDED, TENANT_CONFLICTS, TENANT_HAS_NO_ADMINISTRATOR, TENANT_NOT_FOUND } from './constants';
import type { CreateTenantDto, ListTenantsQueryDto, UpdateTenantDto } from './dto/tenant.dto';
import { TenantsRepository } from './tenants.repository';
import type { PlatformActor } from './types/tenant';

@Injectable()
export class TenantsService {
  constructor(private readonly tenants: TenantsRepository) {}

  async list(query: ListTenantsQueryDto) {
    const [page, counts] = await Promise.all([this.tenants.list(query), this.tenants.counts()]);
    return { ...page, page: query.page, pageSize: query.pageSize, counts };
  }

  async get(id: string) {
    const organization = await this.tenants.findById(id);
    if (!organization) throw new NotFoundException(TENANT_NOT_FOUND);
    const [administrators, membership] = await Promise.all([this.tenants.findAdministrators(id), this.tenants.findMembership(id)]);
    return { ...this.toTenant(organization), administrators, membership };
  }

  // The answer names the new company and login, never the password.
  async create(body: CreateTenantDto, actor: PlatformActor) {
    const { organization, administrator } = body;
    if (passwordProblems(administrator.password).length > 0) {
      throw new BadRequestException({ message: PASSWORD_RULE, code: 'PASSWORD_TOO_WEAK' });
    }
    const result = await this.tenants.create(
      {
        organization: { ...organization, contactPhone: organization.contactPhone ?? null, address: organization.address ?? null },
        administrator: { username: administrator.username, email: administrator.email, passwordHash: await hashPassword(administrator.password) },
      },
      actor,
    );
    if (!result.created) throw new ConflictException(TENANT_CONFLICTS[result.conflict]);
    const { id, username, email } = result.administrator;
    return { tenant: this.toTenant(result.organization), administrator: { id, username, email } };
  }

  async update(id: string, changes: UpdateTenantDto, actor: PlatformActor) {
    const organization = await this.tenants.update(id, changes, actor);
    if (!organization) throw new NotFoundException(TENANT_NOT_FOUND);
    return this.toTenant(organization);
  }

  async setActive(id: string, isActive: boolean, reason: string | null, actor: PlatformActor) {
    const result = await this.tenants.setActive(id, isActive, reason, actor);
    if (result.changed) return this.toTenant(result.organization);
    if (result.problem === 'not_found') throw new NotFoundException(TENANT_NOT_FOUND);
    if (result.problem === 'no_administrator') throw new ConflictException(TENANT_HAS_NO_ADMINISTRATOR);
    throw new ConflictException(isActive ? TENANT_ALREADY_ACTIVE : TENANT_ALREADY_SUSPENDED);
  }

  // The organization fields a tenant answer shows.
  private toTenant(organization: Organization) {
    const { id, name, slug, contactEmail, contactPhone, address, isActive, createdAt, updatedAt } = organization;
    return { id, name, slug, contactEmail, contactPhone, address, isActive, createdAt, updatedAt };
  }
}

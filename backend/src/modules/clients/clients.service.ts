import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { RequestMeta } from '../../common/context/request-meta';
import { ID_PATTERN } from '../../common/ids';
import type { TenantContext } from '../../common/types/authenticated-request';
import { type AuditAction, AuditService } from '../audit';
import { PermissionPolicyService } from '../rbac';
import { type AuditStep, ClientsRepository } from './clients.repository';
import {
  CLIENT_CODE_TAKEN, CLIENT_COORDINATES_UNPAIRED, CLIENT_FINANCIALS_FORBIDDEN, CLIENT_NOT_FOUND, FINANCIALS_PERMISSION,
} from './constants';
import type { CreateClientDto, ListClientsQueryDto, UpdateClientDto } from './dto/client.dto';
import type { Client } from './entities/client.entity';
import type { ClientChanges, ClientView } from './types/client';

// Who is asking: the verified company and role, and the account, for the audit row.
export interface ClientsActor {
  tenant: TenantContext;
  userId: string;
  meta: RequestMeta;
}

// Balances and the rate tier only for clients.view_financials; everything else for anyone with clients.view. Listed
// field by field, so a new column is never answered by accident.
function publicClient(client: Client, withFinancials: boolean): ClientView {
  const view: ClientView = {
    id: client.id,
    clientCode: client.clientCode,
    businessName: client.businessName,
    tradeLicenseNo: client.tradeLicenseNo,
    contactPersonName: client.contactPersonName,
    contactTitle: client.contactTitle,
    mobile1: client.mobile1,
    mobile2: client.mobile2,
    email: client.email,
    billingAddress: client.billingAddress,
    defaultPickupAddress: client.defaultPickupAddress,
    pickupLatitude: client.pickupLatitude,
    pickupLongitude: client.pickupLongitude,
    operationalNotes: client.operationalNotes,
    isActive: client.isActive,
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
  };
  if (!withFinancials) return view;
  const { currentBalance, pendingCodBalance, rateProfileTier } = client;
  return { ...view, currentBalance, pendingCodBalance, rateProfileTier };
}

// The same value however it was typed ("31.87" is saved as 31.87000000), so an unchanged pin isn't a change.
function coordinate(value: string | null | undefined): string | null | undefined {
  return typeof value === 'string' ? Number(value).toFixed(8) : value;
}

// A malformed id names no client, like an unknown one.
function requireId(id: string) {
  if (!ID_PATTERN.test(id)) throw new NotFoundException(CLIENT_NOT_FOUND);
}

// The saved client of an update, or the refusal it ended in.
function savedClient(result: Awaited<ReturnType<ClientsRepository['update']>>): Client {
  if (result.status === 'not_found') throw new NotFoundException(CLIENT_NOT_FOUND);
  if (result.status === 'code_taken') throw new ConflictException(CLIENT_CODE_TAKEN);
  return result.client;
}

function requirePairedCoordinates(latitude: unknown, longitude: unknown) {
  if ((latitude === undefined) !== (longitude === undefined) || (latitude === null) !== (longitude === null)) {
    throw new BadRequestException(CLIENT_COORDINATES_UNPAIRED);
  }
}

// The merchant accounts of the open company. The company always comes from the verified tenant context, never from
// the request.
@Injectable()
export class ClientsService {
  constructor(
    private readonly clients: ClientsRepository,
    private readonly policy: PermissionPolicyService,
    private readonly audit: AuditService,
  ) {}

  async list(tenant: TenantContext, query: ListClientsQueryDto) {
    const [page, counts, withFinancials] = await Promise.all([
      this.clients.list(tenant.organizationId, query),
      this.clients.counts(tenant.organizationId),
      this.seesFinancials(tenant),
    ]);
    return {
      items: page.items.map((client) => publicClient(client, withFinancials)),
      total: page.total,
      page: query.page,
      pageSize: query.pageSize,
      counts,
    };
  }

  async get(tenant: TenantContext, id: string) {
    requireId(id);
    const [client, withFinancials] = await Promise.all([this.clients.find(tenant.organizationId, id), this.seesFinancials(tenant)]);
    if (!client) throw new NotFoundException(CLIENT_NOT_FOUND);
    return publicClient(client, withFinancials);
  }

  async create(actor: ClientsActor, body: CreateClientDto) {
    const withFinancials = await this.requireTierAccess(actor.tenant, body.rateProfileTier);
    requirePairedCoordinates(body.pickupLatitude ?? null, body.pickupLongitude ?? null);
    const result = await this.clients.create(actor.tenant.organizationId, {
      clientCode: body.clientCode,
      businessName: body.businessName,
      tradeLicenseNo: body.tradeLicenseNo ?? null,
      contactPersonName: body.contactPersonName,
      contactTitle: body.contactTitle ?? null,
      mobile1: body.mobile1,
      mobile2: body.mobile2 ?? null,
      email: body.email,
      billingAddress: body.billingAddress,
      defaultPickupAddress: body.defaultPickupAddress,
      pickupLatitude: coordinate(body.pickupLatitude) ?? null,
      pickupLongitude: coordinate(body.pickupLongitude) ?? null,
      rateProfileTier: body.rateProfileTier ?? 'standard',
      operationalNotes: body.operationalNotes ?? null,
    }, this.auditStep(actor, 'create'));
    if (result.status === 'code_taken') throw new ConflictException(CLIENT_CODE_TAKEN);
    return publicClient(result.client, withFinancials);
  }

  async update(actor: ClientsActor, id: string, body: UpdateClientDto) {
    requireId(id);
    const withFinancials = await this.requireTierAccess(actor.tenant, body.rateProfileTier);
    requirePairedCoordinates(body.pickupLatitude, body.pickupLongitude);
    const changes: ClientChanges = {
      ...body,
      pickupLatitude: coordinate(body.pickupLatitude),
      pickupLongitude: coordinate(body.pickupLongitude),
    };
    const result = await this.clients.update(actor.tenant.organizationId, id, changes, this.auditStep(actor, 'update'));
    return publicClient(savedClient(result), withFinancials);
  }

  // Archiving keeps the record and its history; it only stops new parcels for the merchant.
  async setActive(actor: ClientsActor, id: string, isActive: boolean) {
    requireId(id);
    const [result, withFinancials] = await Promise.all([
      this.clients.setActive(actor.tenant.organizationId, id, isActive, this.auditStep(actor, 'status_change')),
      this.seesFinancials(actor.tenant),
    ]);
    return publicClient(savedClient(result), withFinancials);
  }

  private seesFinancials(tenant: TenantContext): Promise<boolean> {
    return this.policy.canAccess(tenant.roleId, FINANCIALS_PERMISSION);
  }

  // Setting the rate tier is financial too: refused rather than ignored, so nobody believes it was saved.
  private async requireTierAccess(tenant: TenantContext, rateProfileTier: string | undefined): Promise<boolean> {
    const withFinancials = await this.seesFinancials(tenant);
    if (rateProfileTier !== undefined && !withFinancials) throw new ForbiddenException(CLIENT_FINANCIALS_FORBIDDEN);
    return withFinancials;
  }

  // The audit row for a change, written in the change's transaction. Status changes store only isActive.
  private auditStep(actor: ClientsActor, action: AuditAction): AuditStep {
    return (manager: EntityManager, before: Client | null, after: Client) => this.audit.record(manager, {
      module: 'clients',
      action,
      resourceType: 'client',
      recordId: after.id,
      resourceLabel: after.businessName,
      organizationId: actor.tenant.organizationId,
      actorId: actor.userId,
      before: action === 'status_change' ? { isActive: before?.isActive } : before,
      after: action === 'status_change' ? { isActive: after.isActive } : after,
      meta: actor.meta,
    });
  }
}

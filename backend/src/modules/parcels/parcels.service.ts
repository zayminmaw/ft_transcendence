import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { RequestMeta } from '../../common/context/request-meta';
import { ID_PATTERN } from '../../common/ids';
import type { TenantContext } from '../../common/types/authenticated-request';
import { type AuditAction, AuditService } from '../audit';
import { PendingCodService } from '../billing';
import { PARCEL_CLIENT_UNAVAILABLE, PARCEL_DRIVER_UNAVAILABLE, PARCEL_NOT_FOUND, PARCEL_WRONG_STATUS } from './constants';
import type { AssignParcelDto, CreateParcelDto, ListParcelsQueryDto, StatusMoveDto } from './dto/parcel.dto';
import { type AuditStep, type ParcelResult, ParcelsRepository, type Refusal } from './parcels.repository';
import type { ParcelRecord } from './types/parcel';

// Who is asking: the verified company and role, and the account, for the history and the audit row.
export interface ParcelsActor {
  tenant: TenantContext;
  userId: string;
  meta: RequestMeta;
}

const REFUSALS: Record<Refusal, () => Error> = {
  not_found: () => new NotFoundException(PARCEL_NOT_FOUND),
  client_unavailable: () => new BadRequestException(PARCEL_CLIENT_UNAVAILABLE),
  driver_unavailable: () => new ConflictException(PARCEL_DRIVER_UNAVAILABLE),
  wrong_status: () => new ConflictException(PARCEL_WRONG_STATUS),
};

function savedParcel(result: ParcelResult): ParcelRecord {
  if ('parcel' in result) return result.parcel;
  throw REFUSALS[result.status]();
}

// A malformed id names no parcel, like an unknown one.
function requireId(id: string) {
  if (!ID_PATTERN.test(id)) throw new NotFoundException(PARCEL_NOT_FOUND);
}

// What the audit trail keeps of a parcel: the client, driver, vehicle and run by id. The allowlist in audit-resources
// stores only its fields (the nested objects and timestamps are dropped) and decides what the platform may see.
function auditSnapshot(parcel: ParcelRecord | null) {
  if (!parcel) return null;
  const { client, driver, vehicle, run } = parcel;
  return { ...parcel, clientId: client.id, driverId: driver?.id ?? null, vehicleId: vehicle?.id ?? null, runId: run?.id ?? null };
}

// The parcels of the open company. The company always comes from the verified tenant context, never from the
// request.
@Injectable()
export class ParcelsService {
  constructor(
    private readonly parcels: ParcelsRepository,
    private readonly audit: AuditService,
    private readonly pendingCod: PendingCodService,
  ) {}

  async list(tenant: TenantContext, query: ListParcelsQueryDto) {
    const [page, counts] = await Promise.all([
      this.parcels.list(tenant.organizationId, query),
      this.parcels.counts(tenant.organizationId),
    ]);
    return { items: page.items, total: page.total, page: query.page, pageSize: query.pageSize, counts };
  }

  async get(tenant: TenantContext, id: string) {
    requireId(id);
    const parcel = await this.parcels.find(tenant.organizationId, id);
    if (!parcel) throw new NotFoundException(PARCEL_NOT_FOUND);
    return parcel;
  }

  formOptions(tenant: TenantContext) {
    return this.parcels.formOptions(tenant.organizationId);
  }

  dispatchDrivers(tenant: TenantContext) {
    return this.parcels.dispatchDrivers(tenant.organizationId);
  }

  async create(actor: ParcelsActor, body: CreateParcelDto) {
    const { notes = null, ...values } = body;
    const result = await this.parcels.create(
      actor.tenant.organizationId,
      actor.userId,
      {
        ...values,
        recipientSecondaryPhone: values.recipientSecondaryPhone ?? null,
        deliveryLandmark: values.deliveryLandmark ?? null,
        isFragile: values.isFragile ?? false,
        // Saved as typed would be "1.5"; the DECIMAL column answers "1.50".
        weightKg: Number(values.weightKg).toFixed(2),
        deliveryFee: Number(values.deliveryFee).toFixed(2),
        codAmount: Number(values.codAmount).toFixed(2),
      },
      notes,
      this.auditStep(actor, 'create'),
    );
    return savedParcel(result);
  }

  async move(actor: ParcelsActor, id: string, body: StatusMoveDto) {
    requireId(id);
    const result = await this.parcels.move(
      actor.tenant.organizationId, id, actor.userId, body, this.withPendingCod(actor, this.auditStep(actor, 'status_change')),
    );
    return savedParcel(result);
  }

  async assign(actor: ParcelsActor, id: string, body: AssignParcelDto) {
    requireId(id);
    const result = await this.parcels.assign(
      actor.tenant.organizationId, id, actor.userId, body.driverId, body.notes ?? null,
      this.withPendingCod(actor, this.auditStep(actor, 'assign')),
    );
    return savedParcel(result);
  }

  // Runs in the change's transaction before its audit row. A first dispatch puts the parcel's cash in transit; a return
  // to the merchant takes it out, since it will never be collected. A reattempt after a failed attempt changes nothing,
  // the cash is already in transit.
  private withPendingCod(actor: ParcelsActor, audit: AuditStep): AuditStep {
    return async (manager, before, after) => {
      const change = { organizationId: actor.tenant.organizationId, clientId: after.client.id, codAmount: after.codAmount, userId: actor.userId };
      if (before?.status === 'in_hub_sorted' && after.status === 'out_for_delivery') await this.pendingCod.hold(manager, change);
      if (before?.status === 'failed_attempt' && after.status === 'returned_to_sender') await this.pendingCod.release(manager, change);
      await audit(manager, before, after);
    };
  }

  // The audit row for a change, written in the change's transaction. It also tells everyone viewing parcels to
  // refresh (notifications module).
  private auditStep(actor: ParcelsActor, action: AuditAction): AuditStep {
    return (manager: EntityManager, before: ParcelRecord | null, after: ParcelRecord) => this.audit.record(manager, {
      module: 'parcels',
      action,
      resourceType: 'parcel',
      recordId: after.id,
      resourceLabel: after.trackingNumber,
      organizationId: actor.tenant.organizationId,
      actorId: actor.userId,
      before: auditSnapshot(before),
      after: auditSnapshot(after),
      meta: actor.meta,
    });
  }
}

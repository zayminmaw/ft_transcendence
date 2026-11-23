import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { RequestMeta } from '../../common/context/request-meta';
import { ID_PATTERN } from '../../common/ids';
import type { TenantContext } from '../../common/types/authenticated-request';
import { type AuditAction, AuditService } from '../audit';
import { PendingCodService } from '../billing';
import { IMAGE_TYPES, StorageService, type UploadedFileInput } from '../storage';
import {
  PARCEL_CLIENT_UNAVAILABLE, PARCEL_DRIVER_UNAVAILABLE, PARCEL_NOT_FOUND, PARCEL_PROOF_KIND, PARCEL_PROOF_MISSING, PARCEL_PROOF_TYPE,
  PARCEL_WRONG_STATUS, PROOF_FILES, PROOF_KINDS, type ProofKind,
} from './constants';
import type { AssignParcelDto, CreateParcelDto, DeliverParcelDto, ListParcelsQueryDto, StatusMoveDto } from './dto/parcel.dto';
import { type AuditStep, type ParcelResult, ParcelsRepository, type ProofFileIds, type Refusal } from './parcels.repository';
import type { ParcelDetails, ParcelProof, ParcelRecord, ProofFile } from './types/parcel';

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
  proof_missing: () => new ConflictException(PARCEL_PROOF_MISSING),
};

function savedParcel(result: ParcelResult): ParcelRecord {
  if ('parcel' in result) return result.parcel;
  throw REFUSALS[result.status]();
}

// A malformed id names no parcel, like an unknown one.
function requireId(id: string) {
  if (!ID_PATTERN.test(id)) throw new NotFoundException(PARCEL_NOT_FOUND);
}

function requireKind(kind: string): ProofKind {
  if (!Object.hasOwn(PROOF_FILES, kind)) throw new NotFoundException(PARCEL_PROOF_KIND);
  return kind as ProofKind;
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
    private readonly storage: StorageService,
  ) {}

  async list(tenant: TenantContext, query: ListParcelsQueryDto) {
    const [page, counts] = await Promise.all([
      this.parcels.list(tenant.organizationId, query),
      this.parcels.counts(tenant.organizationId),
    ]);
    return { items: page.items, total: page.total, page: query.page, pageSize: query.pageSize, counts };
  }

  // With signed links to its proof files: whoever may read the parcel may open them.
  async get(tenant: TenantContext, id: string): Promise<ParcelDetails> {
    requireId(id);
    const stored = await this.parcels.find(tenant.organizationId, id);
    if (!stored) throw new NotFoundException(PARCEL_NOT_FOUND);
    const { proofFileIds, ...parcel } = stored;
    return { ...parcel, proof: await this.proofOf(tenant.organizationId, proofFileIds) };
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
    const parcel = savedParcel(result);
    if (result.status === 'updated' && result.discardedFileIds) await this.removeFiles(actor.tenant.organizationId, result.discardedFileIds);
    return parcel;
  }

  async assign(actor: ParcelsActor, id: string, body: AssignParcelDto) {
    requireId(id);
    const result = await this.parcels.assign(
      actor.tenant.organizationId, id, actor.userId, body.driverId, body.notes ?? null,
      this.withPendingCod(actor, this.auditStep(actor, 'assign')),
    );
    return savedParcel(result);
  }

  // One file of the proof of a parcel out for delivery, replacing the one before. The file is written first, so it is
  // removed again if the parcel refuses it (it moved on meanwhile); the replaced file goes once the parcel no longer
  // points at it.
  async uploadProof(actor: ParcelsActor, id: string, kind: string, file: UploadedFileInput | undefined): Promise<ProofFile> {
    requireId(id);
    const proofKind = requireKind(kind);
    if (!file) throw new BadRequestException('Choose a file to upload.');
    if (!PROOF_FILES[proofKind].pdf && !IMAGE_TYPES.includes(file.mimetype)) throw new BadRequestException(PARCEL_PROOF_TYPE);
    const organizationId = actor.tenant.organizationId;
    // Not worth writing the file for a parcel that can't take it. Checked again, with the parcel locked, below.
    const status = await this.parcels.statusOf(organizationId, id);
    if (status === null) throw new NotFoundException(PARCEL_NOT_FOUND);
    if (status !== 'out_for_delivery') throw new ConflictException(PARCEL_WRONG_STATUS);
    const saved = await this.storage.save(organizationId, actor.userId, file);
    let previousFileId: string | null;
    try {
      const result = await this.parcels.attachProof(organizationId, id, proofKind, saved.id);
      if (result.status !== 'updated') throw REFUSALS[result.status]();
      previousFileId = result.previousFileId;
    } catch (error) {
      await this.storage.deleteQuietly(organizationId, saved.id);
      throw error;
    }
    const [attached] = await Promise.all([
      this.proofFile(organizationId, saved.id),
      previousFileId && this.storage.deleteQuietly(organizationId, previousFileId),
    ]);
    return attached;
  }

  // Takes one file off the proof of a parcel out for delivery and deletes it. Nothing there is fine.
  async removeProof(actor: ParcelsActor, id: string, kind: string): Promise<void> {
    requireId(id);
    const organizationId = actor.tenant.organizationId;
    const result = await this.parcels.attachProof(organizationId, id, requireKind(kind), null);
    if (result.status !== 'updated') throw REFUSALS[result.status]();
    if (result.previousFileId) await this.storage.deleteQuietly(organizationId, result.previousFileId);
  }

  // Delivered: needs the signature and photo already uploaded. From then on the proof can't change.
  async deliver(actor: ParcelsActor, id: string, body: DeliverParcelDto) {
    requireId(id);
    const values = { latitude: body.latitude ?? null, longitude: body.longitude ?? null, notes: body.notes ?? null };
    const result = await this.parcels.deliver(actor.tenant.organizationId, id, actor.userId, values, this.auditStep(actor, 'status_change'));
    return savedParcel(result);
  }

  private async proofOf(organizationId: string, ids: ProofFileIds): Promise<ParcelProof> {
    const files = await Promise.all(PROOF_KINDS.map((kind) => {
      const fileId = ids[kind];
      // A file whose row is gone shows as missing rather than failing the whole parcel.
      return fileId === null ? null : this.proofFile(organizationId, fileId).catch(() => null);
    }));
    return Object.fromEntries(PROOF_KINDS.map((kind, index) => [kind, files[index]])) as ParcelProof;
  }

  private async proofFile(organizationId: string, fileId: string): Promise<ProofFile> {
    const { id, originalName, mimeType, sizeBytes, url } = await this.storage.linked(organizationId, fileId);
    return { id, name: originalName, mimeType, sizeBytes, url };
  }

  private async removeFiles(organizationId: string, fileIds: string[]): Promise<void> {
    await Promise.all(fileIds.map((fileId) => this.storage.deleteQuietly(organizationId, fileId)));
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

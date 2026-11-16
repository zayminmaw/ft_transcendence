import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { RequestMeta } from '../../common/context/request-meta';
import { ID_PATTERN } from '../../common/ids';
import type { TenantContext } from '../../common/types/authenticated-request';
import { type AuditAction, AuditService } from '../audit';
import { type AssetResult, AssetsRepository, type AuditStep } from './assets.repository';
import {
  ASSET_ALREADY_CHECKED_OUT, ASSET_CHECKED_OUT, ASSET_DECOMMISSIONED, ASSET_DRIVER_UNAVAILABLE, ASSET_FIELDS, ASSET_NOT_CHECKED_OUT,
  ASSET_NOT_FOUND, ASSET_TAG_TAKEN, SERVICE_DUE_BEFORE_SERVICE,
} from './constants';
import type { CheckInDto, CheckOutDto, CreateAssetDto, ListAssetsQueryDto, MaintenanceDto, UpdateAssetDto } from './dto/asset.dto';
import type { AssetDetails, AssetRecord, AssetValues, MaintenanceValues } from './types/asset';

// Who is asking: the verified company, and the account, for the audit row.
export interface AssetsActor {
  tenant: TenantContext;
  userId: string;
  meta: RequestMeta;
}

type Refusal = Exclude<AssetResult['status'], 'created' | 'updated' | 'unchanged'>;

const REFUSALS: Record<Refusal, () => Error> = {
  not_found: () => new NotFoundException(ASSET_NOT_FOUND),
  tag_taken: () => new ConflictException(ASSET_TAG_TAKEN),
  checked_out: () => new ConflictException(ASSET_CHECKED_OUT),
  already_checked_out: () => new ConflictException(ASSET_ALREADY_CHECKED_OUT),
  not_checked_out: () => new ConflictException(ASSET_NOT_CHECKED_OUT),
  decommissioned: () => new ConflictException(ASSET_DECOMMISSIONED),
  driver_unavailable: () => new BadRequestException(ASSET_DRIVER_UNAVAILABLE),
};

// The saved asset of a change, or the refusal it ended in.
function savedAsset(result: AssetResult): AssetDetails {
  if ('asset' in result) return result.asset;
  throw REFUSALS[result.status]();
}

const AMOUNT_FIELDS = ['acquisitionCost', 'currentBookValue', 'serviceCost'];

// The fields sent, without the ones left out (a DTO instance holds them as undefined), and the amounts as saved
// however they were typed ("1.5" is saved as 1.50), so an unchanged amount isn't a change.
function sentValues<T extends object>(body: T): Partial<T> {
  return Object.fromEntries(Object.entries(body)
    .filter(([, value]) => value !== undefined)
    .map(([field, value]) => [field, AMOUNT_FIELDS.includes(field) ? Number(value).toFixed(2) : value])) as Partial<T>;
}

// What a new asset gets for each optional field left out: good, at no cost, with no details.
const CREATE_DEFAULTS = {
  currentCondition: 'good', acquisitionCost: '0.00', currentBookValue: '0.00', licensePlate: null, vin: null,
  insurancePolicyNumber: null, roadTaxExpiry: null, notes: null,
} as const satisfies Partial<AssetValues>;
// And a service: free of charge, with no workshop, next due date or notes.
const SERVICE_DEFAULTS = {
  serviceCost: '0.00', vendorServiceCenter: null, nextServiceDue: null, notes: null,
} as const satisfies Partial<MaintenanceValues>;

// A malformed id names no asset, like an unknown one.
function requireId(id: string) {
  if (!ID_PATTERN.test(id)) throw new NotFoundException(ASSET_NOT_FOUND);
}

// What the audit trail keeps of an asset before and after a change.
type Snapshot = (asset: AssetRecord) => Record<string, unknown>;
const editSnapshot: Snapshot = (asset) => Object.fromEntries(ASSET_FIELDS.map((field) => [field, asset[field]]));
const holderSnapshot: Snapshot = ({ holder }) => ({ holder: holder && { driverId: holder.driverId, driverName: holder.driverName } });
const returnSnapshot: Snapshot = (asset) => ({ ...holderSnapshot(asset), currentCondition: asset.currentCondition });

// The vehicles and equipment of the open company. The company always comes from the verified tenant context, never
// from the request.
@Injectable()
export class AssetsService {
  constructor(
    private readonly assets: AssetsRepository,
    private readonly audit: AuditService,
  ) {}

  async list(tenant: TenantContext, query: ListAssetsQueryDto) {
    const [page, counts] = await Promise.all([
      this.assets.list(tenant.organizationId, query),
      this.assets.counts(tenant.organizationId),
    ]);
    return { items: page.items, total: page.total, page: query.page, pageSize: query.pageSize, counts };
  }

  async get(tenant: TenantContext, id: string) {
    requireId(id);
    const asset = await this.assets.find(tenant.organizationId, id);
    if (!asset) throw new NotFoundException(ASSET_NOT_FOUND);
    return asset;
  }

  async create(actor: AssetsActor, body: CreateAssetDto) {
    const values = { ...CREATE_DEFAULTS, ...sentValues(body) } as AssetValues;
    return savedAsset(await this.assets.create(actor.tenant.organizationId, values, this.auditStep(actor, 'create', editSnapshot)));
  }

  // Retiring an asset is setting its condition to decommissioned, once nobody has it.
  async update(actor: AssetsActor, id: string, body: UpdateAssetDto) {
    requireId(id);
    const audit = this.auditStep(actor, 'update', editSnapshot);
    return savedAsset(await this.assets.update(actor.tenant.organizationId, id, sentValues(body), audit));
  }

  async checkOut(actor: AssetsActor, id: string, body: CheckOutDto) {
    requireId(id);
    const values = { driverId: body.driverId, notes: body.notes ?? null };
    return savedAsset(await this.assets.checkOut(actor.tenant.organizationId, id, values, this.auditStep(actor, 'assign', holderSnapshot)));
  }

  async checkIn(actor: AssetsActor, id: string, body: CheckInDto) {
    requireId(id);
    const values = { condition: body.condition, notes: body.notes ?? null };
    return savedAsset(await this.assets.checkIn(actor.tenant.organizationId, id, values, this.auditStep(actor, 'revoke', returnSnapshot)));
  }

  // 'YYYY-MM-DD' strings compare in date order. The audit row keeps the condition, and the service as logged.
  async logMaintenance(actor: AssetsActor, id: string, body: MaintenanceDto) {
    requireId(id);
    if (body.nextServiceDue && body.nextServiceDue <= body.serviceDate) throw new BadRequestException(SERVICE_DUE_BEFORE_SERVICE);
    const { condition, ...service } = { ...SERVICE_DEFAULTS, ...sentValues(body) } as MaintenanceValues;
    const audit = this.auditStep(actor, 'update', (asset) => ({ currentCondition: asset.currentCondition }), { service });
    return savedAsset(await this.assets.logMaintenance(actor.tenant.organizationId, id, { ...service, condition }, audit));
  }

  // The audit row for a change, written in the change's transaction: the snapshot of the asset before and after, and
  // anything the change adds to the after side.
  private auditStep(actor: AssetsActor, action: AuditAction, snapshot: Snapshot, added: object = {}): AuditStep {
    return (manager: EntityManager, before, after) => this.audit.record(manager, {
      module: 'assets',
      action,
      resourceType: 'asset',
      recordId: after.id,
      resourceLabel: after.assetTag,
      organizationId: actor.tenant.organizationId,
      actorId: actor.userId,
      before: before && snapshot(before),
      after: { ...snapshot(after), ...added },
      meta: actor.meta,
    });
  }
}

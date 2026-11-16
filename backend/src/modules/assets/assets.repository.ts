import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { isDuplicateKey } from '../../common/database-errors';
import { containsPattern } from '../../common/like-pattern';
import { checkInRefusal, checkOutRefusal, maintenanceRefusal, planUpdate, type RuleRefusal } from './asset-rules';
import { EXPIRY_WARNING_DAYS, READY_CONDITIONS } from './constants';
import { Asset } from './entities/asset.entity';
import { AssetAssignment } from './entities/asset-assignment.entity';
import { AssetMaintenanceLog } from './entities/asset-maintenance-log.entity';
import type {
  AssetAssignmentRecord, AssetChanges, AssetCounts, AssetDetails, AssetListQuery, AssetRecord, AssetValues, CheckIn, CheckOut,
  MaintenanceRecord, MaintenanceValues,
} from './types/asset';

// Writes its audit row with the change's own manager, so both are saved or neither.
export type AuditStep = (manager: EntityManager, before: AssetRecord | null, after: AssetRecord) => Promise<void>;

type Saved = { status: 'created' | 'updated' | 'unchanged'; asset: AssetDetails };
// Every answer of a change: the saved asset, or the refusal it ended in.
export type AssetResult = Saved | { status: RuleRefusal | 'not_found' | 'tag_taken' | 'driver_unavailable' };

type Row = Record<string, unknown>;

// An asset with who has it (the check-out without a check-in, at most one) and the next service due from its latest
// service that set one. Every query adds its own conditions after the company's.
const ASSET_FROM = `
    FROM assets asset
    LEFT JOIN asset_assignments holder ON holder.asset_id = asset.id AND holder.checked_in_at IS NULL
    LEFT JOIN employees driver ON driver.id = holder.driver_id
   WHERE asset.organization_id = ?`;
const ASSET_SELECT = `
  SELECT asset.id, asset.asset_tag AS assetTag, asset.asset_name AS assetName, asset.category,
         asset.acquisition_cost AS acquisitionCost, asset.current_book_value AS currentBookValue,
         asset.license_plate AS licensePlate, asset.vin, asset.insurance_policy_number AS insurancePolicyNumber,
         DATE_FORMAT(asset.road_tax_expiry, '%Y-%m-%d') AS roadTaxExpiry, asset.current_condition AS currentCondition,
         asset.notes, asset.created_at AS createdAt, asset.updated_at AS updatedAt,
         holder.id AS holderId, holder.driver_id AS holderDriverId,
         CONCAT(driver.first_name, ' ', driver.last_name) AS holderDriverName,
         holder.checked_out_at AS holderCheckedOutAt, holder.checkout_notes AS holderCheckoutNotes,
         (SELECT DATE_FORMAT(service.next_service_due, '%Y-%m-%d') FROM asset_maintenance_logs service
           WHERE service.asset_id = asset.id AND service.next_service_due IS NOT NULL
           ORDER BY service.service_date DESC, service.id DESC LIMIT 1) AS nextServiceDue
  ${ASSET_FROM}`;

const SORT_COLUMNS = { assetTag: 'asset.asset_tag', assetName: 'asset.asset_name' } as const;
const SEARCHED = ['asset.asset_tag', 'asset.asset_name', 'asset.license_plate', "CONCAT(driver.first_name, ' ', driver.last_name)"];
const READY = READY_CONDITIONS.map((condition) => `'${condition}'`).join(', ');
const STATUS_WHERE = {
  all: '',
  available: ` AND holder.id IS NULL AND asset.current_condition IN (${READY})`,
  checked_out: ' AND holder.id IS NOT NULL',
  needs_maintenance: " AND asset.current_condition = 'needs_maintenance'",
  decommissioned: " AND asset.current_condition = 'decommissioned'",
} as const;

const text = (value: unknown) => (value === null || value === undefined ? null : String(value));

function toRecord(row: Row): AssetRecord {
  return {
    id: String(row.id),
    assetTag: String(row.assetTag),
    assetName: String(row.assetName),
    category: row.category as AssetRecord['category'],
    acquisitionCost: String(row.acquisitionCost),
    currentBookValue: String(row.currentBookValue),
    licensePlate: text(row.licensePlate),
    vin: text(row.vin),
    insurancePolicyNumber: text(row.insurancePolicyNumber),
    roadTaxExpiry: text(row.roadTaxExpiry),
    currentCondition: row.currentCondition as AssetRecord['currentCondition'],
    notes: text(row.notes),
    holder: row.holderId === null ? null : {
      assignmentId: String(row.holderId),
      driverId: String(row.holderDriverId),
      driverName: String(row.holderDriverName),
      checkedOutAt: row.holderCheckedOutAt as Date,
      checkoutNotes: text(row.holderCheckoutNotes),
    },
    nextServiceDue: text(row.nextServiceDue),
    createdAt: row.createdAt as Date,
    updatedAt: row.updatedAt as Date,
  };
}

// The vehicles and equipment of one company, who has them, and their services. Every query and change is scoped to
// the company; an id from another company is simply not found. Each change locks the asset row first, so two
// check-outs of one asset run one after the other and only the first finds it free.
@Injectable()
export class AssetsRepository {
  constructor(private readonly database: DataSource) {}

  // Every value is a parameter and the sort comes from SORT_COLUMNS; the id breaks ties, so pages never overlap. The
  // joins are one-to-one, so plain offset/limit pages correctly.
  async list(organizationId: string, query: AssetListQuery): Promise<{ items: AssetRecord[]; total: number }> {
    let where = STATUS_WHERE[query.status];
    const params: unknown[] = [organizationId];
    if (query.search) {
      where += ` AND (${SEARCHED.map((column) => `${column} LIKE ?`).join(' OR ')})`;
      params.push(...SEARCHED.map(() => containsPattern(query.search!)));
    }
    const direction = query.direction === 'desc' ? 'DESC' : 'ASC';
    const [rows, [count]] = await Promise.all([
      this.database.query(
        `${ASSET_SELECT}${where} ORDER BY ${SORT_COLUMNS[query.sort]} ${direction}, asset.id ${direction} LIMIT ? OFFSET ?`,
        [...params, query.pageSize, (query.page - 1) * query.pageSize],
      ) as Promise<Row[]>,
      this.database.query(`SELECT COUNT(*) AS total ${ASSET_FROM}${where}`, params) as Promise<Row[]>,
    ]);
    return { items: rows.map(toRecord), total: Number(count?.total ?? 0) };
  }

  // Over the whole company, whatever the search and filter. Road tax expiring within EXPIRY_WARNING_DAYS, or already
  // expired, is due.
  async counts(organizationId: string): Promise<AssetCounts> {
    const [row] = await this.database.query(
      `SELECT COALESCE(SUM(asset.current_condition <> 'decommissioned'), 0) AS inService,
              COALESCE(SUM(asset.current_condition <> 'decommissioned' AND holder.id IS NOT NULL), 0) AS checkedOut,
              COALESCE(SUM(asset.current_condition = 'needs_maintenance'), 0) AS needsMaintenance,
              COALESCE(SUM(asset.current_condition = 'decommissioned'), 0) AS decommissioned,
              COALESCE(SUM(asset.current_condition <> 'decommissioned'
                AND asset.road_tax_expiry <= CURDATE() + INTERVAL ? DAY), 0) AS roadTaxDue
       ${ASSET_FROM}`,
      [EXPIRY_WARNING_DAYS, organizationId],
    ) as Row[];
    return Object.fromEntries(Object.entries(row!).map(([name, value]) => [name, Number(value)])) as unknown as AssetCounts;
  }

  find(organizationId: string, id: string): Promise<AssetDetails | null> {
    return this.details(this.database.manager, organizationId, id);
  }

  async create(organizationId: string, values: AssetValues, audit: AuditStep): Promise<AssetResult> {
    try {
      return await this.database.transaction(async (manager) => {
        const { identifiers } = await manager.insert(Asset, { ...values, organizationId });
        const asset = (await this.details(manager, organizationId, String(identifiers[0]?.id)))!;
        await audit(manager, null, asset);
        return { status: 'created', asset };
      });
    } catch (error) {
      if (isDuplicateKey(error)) return { status: 'tag_taken' };
      throw error;
    }
  }

  // Changes equal to the saved values write nothing. What changes, and whether it may, is planUpdate's decision.
  async update(organizationId: string, id: string, changes: AssetChanges, audit: AuditStep): Promise<AssetResult> {
    try {
      return await this.change(organizationId, id, async (manager, before) => {
        const plan = planUpdate(before, changes);
        if ('refusal' in plan) return { status: plan.refusal };
        if (Object.keys(plan.changed).length === 0) return { status: 'unchanged', asset: (await this.details(manager, organizationId, id))! };
        await manager.update(Asset, { organizationId, id }, plan.changed);
        return this.saved(manager, organizationId, before, audit);
      });
    } catch (error) {
      if (isDuplicateKey(error)) return { status: 'tag_taken' };
      throw error;
    }
  }

  // To a driver of this company who still works here. The driver's row is held shared, so they can't be terminated
  // halfway.
  checkOut(organizationId: string, id: string, { driverId, notes }: CheckOut, audit: AuditStep): Promise<AssetResult> {
    return this.change(organizationId, id, async (manager, before) => {
      const refusal = checkOutRefusal(before);
      if (refusal) return { status: refusal };
      const [driver] = await manager.query(
        `SELECT employee.id FROM employees employee
           JOIN delivery_drivers courier ON courier.employee_id = employee.id
          WHERE employee.organization_id = ? AND employee.id = ? AND employee.employment_status <> 'terminated'
          LOCK IN SHARE MODE`,
        [organizationId, driverId],
      ) as Row[];
      if (!driver) return { status: 'driver_unavailable' };
      await manager.insert(AssetAssignment, { assetId: id, driverId, checkoutNotes: notes });
      await this.touch(manager, organizationId, id, {});
      return this.saved(manager, organizationId, before, audit);
    });
  }

  // Closes the open check-out and records the condition the asset came back in.
  checkIn(organizationId: string, id: string, { condition, notes }: CheckIn, audit: AuditStep): Promise<AssetResult> {
    return this.change(organizationId, id, async (manager, before) => {
      const refusal = checkInRefusal(before);
      if (refusal) return { status: refusal };
      await manager.update(
        AssetAssignment,
        { id: before.holder!.assignmentId },
        { checkedInAt: () => 'CURRENT_TIMESTAMP', checkinNotes: notes },
      );
      await this.touch(manager, organizationId, id, { currentCondition: condition });
      return this.saved(manager, organizationId, before, audit);
    });
  }

  // Adds the service to the log and records the condition the asset left the workshop in.
  logMaintenance(organizationId: string, id: string, { condition, ...log }: MaintenanceValues, audit: AuditStep): Promise<AssetResult> {
    return this.change(organizationId, id, async (manager, before) => {
      const refusal = maintenanceRefusal(before);
      if (refusal) return { status: refusal };
      await manager.insert(AssetMaintenanceLog, { ...log, assetId: id });
      await this.touch(manager, organizationId, id, { currentCondition: condition });
      return this.saved(manager, organizationId, before, audit);
    });
  }

  // Locks the asset row until the transaction ends, then hands the work the asset as it is (without its history).
  private change(
    organizationId: string,
    id: string,
    work: (manager: EntityManager, before: AssetRecord) => Promise<AssetResult>,
  ): Promise<AssetResult> {
    return this.database.transaction(async (manager) => {
      const [locked] = await manager.query(
        'SELECT id FROM assets WHERE organization_id = ? AND id = ? FOR UPDATE', [organizationId, id],
      ) as Row[];
      if (!locked) return { status: 'not_found' };
      return work(manager, (await this.record(manager, organizationId, id))!);
    });
  }

  // Always written, so updated_at moves when only a check-out or a service changed.
  private async touch(manager: EntityManager, organizationId: string, id: string, values: Partial<Asset>) {
    await manager.update(Asset, { organizationId, id }, { ...values, updatedAt: () => 'CURRENT_TIMESTAMP' });
  }

  private async saved(manager: EntityManager, organizationId: string, before: AssetRecord, audit: AuditStep): Promise<AssetResult> {
    const after = (await this.details(manager, organizationId, before.id))!;
    await audit(manager, before, after);
    return { status: 'updated', asset: after };
  }

  private async record(manager: EntityManager, organizationId: string, id: string): Promise<AssetRecord | null> {
    const [row] = await manager.query(`${ASSET_SELECT} AND asset.id = ?`, [organizationId, id]) as Row[];
    return row ? toRecord(row) : null;
  }

  private async details(manager: EntityManager, organizationId: string, id: string): Promise<AssetDetails | null> {
    const record = await this.record(manager, organizationId, id);
    if (!record) return null;
    const [assignments, logs] = await Promise.all([
      manager.query(
        `SELECT checkout.id, checkout.driver_id AS driverId, CONCAT(driver.first_name, ' ', driver.last_name) AS driverName,
                checkout.checked_out_at AS checkedOutAt, checkout.checked_in_at AS checkedInAt,
                checkout.checkout_notes AS checkoutNotes, checkout.checkin_notes AS checkinNotes
           FROM asset_assignments checkout
           JOIN employees driver ON driver.id = checkout.driver_id
          WHERE checkout.asset_id = ?
          ORDER BY checkout.checked_out_at DESC, checkout.id DESC`,
        [id],
      ) as Promise<Row[]>,
      manager.query(
        `SELECT id, DATE_FORMAT(service_date, '%Y-%m-%d') AS serviceDate, service_type AS serviceType,
                service_cost AS serviceCost, vendor_service_center AS vendorServiceCenter,
                DATE_FORMAT(next_service_due, '%Y-%m-%d') AS nextServiceDue, notes, created_at AS createdAt
           FROM asset_maintenance_logs
          WHERE asset_id = ?
          ORDER BY service_date DESC, id DESC`,
        [id],
      ) as Promise<Row[]>,
    ]);
    return {
      ...record,
      assignments: assignments.map((item): AssetAssignmentRecord => ({
        id: String(item.id),
        driverId: String(item.driverId),
        driverName: String(item.driverName),
        checkedOutAt: item.checkedOutAt as Date,
        checkedInAt: (item.checkedInAt as Date | null) ?? null,
        checkoutNotes: text(item.checkoutNotes),
        checkinNotes: text(item.checkinNotes),
      })),
      maintenanceLogs: logs.map((item): MaintenanceRecord => ({
        id: String(item.id),
        serviceDate: String(item.serviceDate),
        serviceType: String(item.serviceType),
        serviceCost: String(item.serviceCost),
        vendorServiceCenter: text(item.vendorServiceCenter),
        nextServiceDue: text(item.nextServiceDue),
        notes: text(item.notes),
        createdAt: item.createdAt as Date,
      })),
    };
  }
}

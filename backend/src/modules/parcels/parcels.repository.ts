import { randomInt } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { isDuplicateKey } from '../../common/database-errors';
import { containsPattern } from '../../common/like-pattern';
import {
  ASSIGNABLE_STATUSES, ON_DUTY_STATUSES, PARCEL_QUEUES, PARCEL_STATUSES, type ParcelStatus, STATUS_MOVES, VEHICLE_CATEGORIES,
} from './constants';
import type { ListParcelsQueryDto, StatusMoveDto } from './dto/parcel.dto';
import { Parcel } from './entities/parcel.entity';
import { ParcelEvent } from './entities/parcel-event.entity';
import type {
  DispatchDriver, NewParcel, ParcelCounts, ParcelDetails, ParcelDriver, ParcelEventRecord, ParcelFormOptions, ParcelRecord,
  ParcelRun, ParcelVehicle,
} from './types/parcel';

// Writes its audit row with the change's own manager, so both are saved or neither.
export type AuditStep = (manager: EntityManager, before: ParcelRecord | null, after: ParcelRecord) => Promise<void>;

export type Refusal = 'not_found' | 'client_unavailable' | 'driver_unavailable' | 'wrong_status';
// Every answer of a change: the saved parcel, or the refusal it ended in.
export type ParcelResult = { status: 'created' | 'updated'; parcel: ParcelRecord } | { status: Refusal };

type Row = Record<string, string | number | Date | null>;

// Changes lock the rows they depend on, so competing changes already run one after the other. Read committed lets each
// statement then see what the one before it committed (e.g. the run another assignment just opened, joined into the
// parcel this one answers); repeatable read would answer from a snapshot taken before the wait.
const WRITES = 'READ COMMITTED';

// Waybills are TRC- and 10 characters without 0/O, 1/I/L or U, so they read back unambiguously: about 10^15
// numbers, so one can't be guessed from another on the public tracking page.
const TRACKING_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
const TRACKING_ATTEMPTS = 5;
function newTrackingNumber(): string {
  let code = '';
  for (let index = 0; index < 10; index++) code += TRACKING_ALPHABET[randomInt(TRACKING_ALPHABET.length)];
  return `TRC-${code}`;
}

// The vehicle (a checked-out motorcycle or van of the company) of the driver in `employee`: the latest checkout wins.
const CURRENT_VEHICLE = `(
  SELECT checkout.asset_id FROM asset_assignments checkout
    JOIN assets candidate ON candidate.id = checkout.asset_id
   WHERE checkout.driver_id = employee.id AND checkout.checked_in_at IS NULL
     AND candidate.organization_id = employee.organization_id AND candidate.category IN (?)
   ORDER BY checkout.checked_out_at DESC, checkout.id DESC
   LIMIT 1
)`;

// The columns driverOf, vehicleOf and runOf read, from an `employees`, `assets` and `dispatch_runs` row.
const DRIVER_COLUMNS = (alias: string) =>
  `${alias}.id AS driverId, ${alias}.first_name AS driverFirstName, ${alias}.last_name AS driverLastName, ${alias}.employee_code AS driverCode`;
const VEHICLE_COLUMNS = `vehicle.id AS vehicleId, vehicle.asset_tag AS vehicleTag, vehicle.asset_name AS vehicleName,
         vehicle.license_plate AS vehiclePlate`;
const RUN_COLUMNS = "run.id AS runId, DATE_FORMAT(run.run_date, '%Y%m%d') AS runDay";

// A parcel and what it points to. Every query adds its own conditions after the company's.
const PARCEL_SELECT = `
  SELECT parcel.id, parcel.tracking_number AS trackingNumber, parcel.lifecycle_status AS status,
         client.id AS clientId, client.client_code AS clientCode, client.business_name AS clientName,
         ${DRIVER_COLUMNS('driver')}, ${VEHICLE_COLUMNS}, ${RUN_COLUMNS},
         parcel.recipient_name AS recipientName, parcel.recipient_phone AS recipientPhone,
         parcel.recipient_secondary_phone AS recipientSecondaryPhone, parcel.delivery_address AS deliveryAddress,
         parcel.delivery_city_zone AS deliveryCityZone, parcel.delivery_landmark AS deliveryLandmark,
         parcel.weight_kg AS weightKg, parcel.is_fragile AS isFragile, parcel.delivery_fee AS deliveryFee,
         parcel.cod_amount AS codAmount, parcel.delivery_attempt_count AS deliveryAttemptCount,
         parcel.failed_reason_code AS failedReasonCode, parcel.created_at AS createdAt, parcel.updated_at AS updatedAt
    FROM parcels parcel
    JOIN clients client ON client.id = parcel.client_id
    LEFT JOIN employees driver ON driver.id = parcel.assigned_driver_id
    LEFT JOIN assets vehicle ON vehicle.id = parcel.assigned_asset_id
    LEFT JOIN dispatch_runs run ON run.id = parcel.dispatch_run_id
   WHERE parcel.organization_id = ?`;

const SORT_COLUMNS = { createdAt: 'parcel.created_at', tracking: 'parcel.tracking_number', merchant: 'client.business_name' } as const;
const SEARCHED = ['parcel.tracking_number', 'parcel.recipient_name', 'parcel.recipient_phone', 'client.business_name'];

const text = (value: Row[string]) => (value === null ? null : String(value));

function driverOf(row: Row): ParcelDriver | null {
  if (row.driverId === null) return null;
  return { id: String(row.driverId), name: `${row.driverFirstName} ${row.driverLastName}`, employeeCode: String(row.driverCode) };
}

function vehicleOf(row: Row): ParcelVehicle | null {
  if (row.vehicleId === null) return null;
  return { id: String(row.vehicleId), tag: String(row.vehicleTag), name: String(row.vehicleName), licensePlate: text(row.vehiclePlate) };
}

function runOf(row: Row): ParcelRun | null {
  return row.runId === null ? null : { id: String(row.runId), code: `RUN-${row.runDay}-${row.runId}` };
}

function toRecord(row: Row): ParcelRecord {
  return {
    id: String(row.id),
    trackingNumber: String(row.trackingNumber),
    status: row.status as ParcelStatus,
    client: { id: String(row.clientId), code: String(row.clientCode), name: String(row.clientName) },
    driver: driverOf(row),
    vehicle: vehicleOf(row),
    run: runOf(row),
    recipientName: String(row.recipientName),
    recipientPhone: String(row.recipientPhone),
    recipientSecondaryPhone: text(row.recipientSecondaryPhone),
    deliveryAddress: String(row.deliveryAddress),
    deliveryCityZone: String(row.deliveryCityZone),
    deliveryLandmark: text(row.deliveryLandmark),
    weightKg: String(row.weightKg),
    // BOOLEAN is TINYINT(1): the driver answers 0 or 1.
    isFragile: Boolean(Number(row.isFragile)),
    deliveryFee: String(row.deliveryFee),
    codAmount: String(row.codAmount),
    deliveryAttemptCount: Number(row.deliveryAttemptCount),
    failedReasonCode: text(row.failedReasonCode),
    createdAt: row.createdAt as Date,
    updatedAt: row.updatedAt as Date,
  };
}

function toEvent(row: Row): ParcelEventRecord {
  return {
    id: String(row.id),
    status: row.status as ParcelStatus,
    at: row.at as Date,
    actor: row.actorId === null ? null : { userId: String(row.actorId), name: String(row.actorDisplayName ?? row.actorUsername) },
    hubLocation: text(row.hubLocation),
    driver: driverOf(row),
    vehicle: vehicleOf(row),
    run: runOf(row),
    reasonCode: text(row.reasonCode),
    notes: text(row.notes),
  };
}

// The parcels of one company and their history. Every query and change is scoped to the company; an id from another
// company is simply not found. A change locks the parcel first, so two people moving it at once run one after the
// other and the second sees where the first left it.
@Injectable()
export class ParcelsRepository {
  constructor(private readonly database: DataSource) {}

  // Every value is a parameter and the sort comes from SORT_COLUMNS; the id breaks ties, so pages never overlap.
  async list(organizationId: string, query: ListParcelsQueryDto): Promise<{ items: ParcelRecord[]; total: number }> {
    const conditions: string[] = [];
    const parameters: unknown[] = [organizationId];
    if (query.search) {
      conditions.push(`(${SEARCHED.map((column) => `${column} LIKE ?`).join(' OR ')})`);
      parameters.push(...SEARCHED.map(() => containsPattern(query.search!)));
    }
    const statuses = query.queue in PARCEL_QUEUES ? PARCEL_QUEUES[query.queue as keyof typeof PARCEL_QUEUES] : [query.queue];
    if (statuses) {
      conditions.push('parcel.lifecycle_status IN (?)');
      parameters.push(statuses);
    }
    const where = conditions.map((condition) => ` AND ${condition}`).join('');
    const direction = query.direction === 'asc' ? 'ASC' : 'DESC';
    const [rows, [{ total }]] = await Promise.all([
      this.database.query(
        `${PARCEL_SELECT}${where} ORDER BY ${SORT_COLUMNS[query.sort]} ${direction}, parcel.id ${direction} LIMIT ? OFFSET ?`,
        [...parameters, query.pageSize, (query.page - 1) * query.pageSize],
      ) as Promise<Row[]>,
      // The merchant is joined only when the search may match its name.
      this.database.query(
        `SELECT COUNT(*) AS total FROM parcels parcel
           ${query.search ? 'JOIN clients client ON client.id = parcel.client_id' : ''}
          WHERE parcel.organization_id = ?${where}`,
        parameters,
      ) as Promise<{ total: string }[]>,
    ]);
    return { items: rows.map(toRecord), total: Number(total) };
  }

  // Over the whole company, whatever the search and filter, in one pass: the parcels per status, and the drivers of
  // the out_for_delivery row.
  async counts(organizationId: string): Promise<ParcelCounts> {
    const rows: { status: ParcelStatus; total: string; drivers: string }[] = await this.database.query(
      `SELECT lifecycle_status AS status, COUNT(*) AS total, COUNT(DISTINCT assigned_driver_id) AS drivers
         FROM parcels WHERE organization_id = ? GROUP BY lifecycle_status`,
      [organizationId],
    );
    const statuses = Object.fromEntries(PARCEL_STATUSES.map((status) => [status, 0])) as Record<ParcelStatus, number>;
    for (const row of rows) statuses[row.status] = Number(row.total);
    const out = rows.find((row) => row.status === 'out_for_delivery');
    return { statuses, driversOut: Number(out?.drivers ?? 0) };
  }

  // The parcel and its history at once; another company's history is never answered, as its parcel isn't found.
  async find(organizationId: string, id: string): Promise<ParcelDetails | null> {
    const [parcel, events] = await Promise.all([this.findOne(this.database.manager, organizationId, id), this.events(id)]);
    return parcel && { ...parcel, events };
  }

  // The active merchants, by name, and the zones already in use (drivers' zones and parcels' zones).
  async formOptions(organizationId: string): Promise<ParcelFormOptions> {
    const [clients, zones] = await Promise.all([
      this.database.query(
        `SELECT id, client_code AS code, business_name AS name FROM clients
          WHERE organization_id = ? AND is_active = TRUE ORDER BY business_name, id`,
        [organizationId],
      ) as Promise<{ id: string; code: string; name: string }[]>,
      this.database.query(
        `SELECT zone FROM (
           SELECT courier.assigned_zone AS zone FROM delivery_drivers courier
             JOIN employees employee ON employee.id = courier.employee_id
            WHERE employee.organization_id = ? AND courier.assigned_zone IS NOT NULL AND courier.assigned_zone <> ''
           UNION
           SELECT delivery_city_zone FROM parcels WHERE organization_id = ?
         ) zones ORDER BY zone LIMIT 200`,
        [organizationId, organizationId],
      ) as Promise<{ zone: string }[]>,
    ]);
    return { clients: clients.map((client) => ({ ...client, id: String(client.id) })), zones: zones.map((row) => row.zone) };
  }

  // The drivers on duty now, by name, with their vehicle and today's run.
  async dispatchDrivers(organizationId: string): Promise<DispatchDriver[]> {
    const rows: Row[] = await this.database.query(
      `SELECT ${DRIVER_COLUMNS('employee')}, ${VEHICLE_COLUMNS}, ${RUN_COLUMNS},
              courier.assigned_zone AS zone, courier.driver_category AS category, courier.dispatch_status AS dispatchStatus,
              (SELECT COUNT(*) FROM parcels parcel
                WHERE parcel.dispatch_run_id = run.id AND parcel.lifecycle_status = 'out_for_delivery') AS parcelsOut
         FROM employees employee
         JOIN delivery_drivers courier ON courier.employee_id = employee.id
         LEFT JOIN assets vehicle ON vehicle.id = ${CURRENT_VEHICLE}
         LEFT JOIN dispatch_runs run
           ON run.organization_id = employee.organization_id AND run.driver_id = employee.id AND run.run_date = UTC_DATE()
        WHERE employee.organization_id = ? AND employee.personnel_type = 'driver'
          AND employee.employment_status <> 'terminated' AND courier.dispatch_status IN (?)
        ORDER BY employee.last_name, employee.first_name, employee.id`,
      [VEHICLE_CATEGORIES, organizationId, ON_DUTY_STATUSES],
    );
    return rows.map((row) => {
      const run = runOf(row);
      return {
        ...driverOf(row)!,
        zone: text(row.zone),
        category: String(row.category),
        dispatchStatus: String(row.dispatchStatus),
        vehicle: vehicleOf(row),
        run: run && { ...run, parcelsOut: Number(row.parcelsOut) },
      };
    });
  }

  // A new waybill for an active merchant of the company, with its pickup scheduled. A waybill number already taken
  // (anywhere) is drawn again.
  create(organizationId: string, actorId: string, values: NewParcel, notes: string | null, audit: AuditStep): Promise<ParcelResult> {
    return this.database.transaction(WRITES, async (manager) => {
      const [client] = await manager.query(
        'SELECT id FROM clients WHERE id = ? AND organization_id = ? AND is_active = TRUE LOCK IN SHARE MODE',
        [values.clientId, organizationId],
      );
      if (!client) return { status: 'client_unavailable' };
      const id = await this.insertParcel(manager, { ...values, organizationId, lifecycleStatus: 'pickup_scheduled' });
      await manager.insert(ParcelEvent, { parcelId: id, actorUserId: actorId, status: 'pickup_scheduled', notes });
      const parcel = (await this.findOne(manager, organizationId, id))!;
      await audit(manager, null, parcel);
      return { status: 'created', parcel };
    });
  }

  // One step forward from the status it must follow (STATUS_MOVES). A failed attempt counts the attempt and keeps the
  // driver it failed with in the history.
  move(organizationId: string, id: string, actorId: string, move: StatusMoveDto, audit: AuditStep): Promise<ParcelResult> {
    return this.database.transaction(WRITES, async (manager) => {
      const before = await this.findOne(manager, organizationId, id, true);
      if (!before) return { status: 'not_found' };
      if (before.status !== STATUS_MOVES[move.status]) return { status: 'wrong_status' };
      const failed = move.status === 'failed_attempt';
      await manager.update(Parcel, { organizationId, id }, {
        lifecycleStatus: move.status,
        ...(failed && { deliveryAttemptCount: () => 'delivery_attempt_count + 1', failedReasonCode: move.reasonCode }),
      });
      await manager.insert(ParcelEvent, {
        parcelId: id,
        actorUserId: actorId,
        status: move.status,
        hubLocation: move.status === 'in_hub_sorted' ? move.hubLocation : null,
        reasonCode: failed ? move.reasonCode : null,
        ...(failed && { driverId: before.driver?.id ?? null, assetId: before.vehicle?.id ?? null, dispatchRunId: before.run?.id ?? null }),
        notes: move.notes ?? null,
      });
      const after = (await this.findOne(manager, organizationId, id))!;
      await audit(manager, before, after);
      return { status: 'updated', parcel: after };
    });
  }

  // Sends a sorted parcel, or a failed attempt again, out with a driver on duty, the vehicle they have checked out,
  // and their run for today (opened if this is their first parcel today). The driver's row is locked, so the driver
  // can't go off duty halfway through.
  assign(organizationId: string, id: string, actorId: string, driverId: string, notes: string | null, audit: AuditStep): Promise<ParcelResult> {
    return this.database.transaction(WRITES, async (manager) => {
      const before = await this.findOne(manager, organizationId, id, true);
      if (!before) return { status: 'not_found' };
      if (!(ASSIGNABLE_STATUSES as readonly ParcelStatus[]).includes(before.status)) return { status: 'wrong_status' };
      const [driver] = await manager.query(
        `SELECT employee.id, ${CURRENT_VEHICLE} AS vehicleId
           FROM employees employee
           JOIN delivery_drivers courier ON courier.employee_id = employee.id
          WHERE employee.id = ? AND employee.organization_id = ? AND employee.personnel_type = 'driver'
            AND employee.employment_status <> 'terminated' AND courier.dispatch_status IN (?)
          FOR UPDATE`,
        [VEHICLE_CATEGORIES, driverId, organizationId, ON_DUTY_STATUSES],
      );
      if (!driver) return { status: 'driver_unavailable' };
      const runId = await this.todaysRun(manager, organizationId, driverId, actorId);
      const vehicleId = driver.vehicleId === null ? null : String(driver.vehicleId);
      await manager.update(Parcel, { organizationId, id }, {
        lifecycleStatus: 'out_for_delivery', assignedDriverId: driverId, assignedAssetId: vehicleId, dispatchRunId: runId,
      });
      await manager.insert(ParcelEvent, {
        parcelId: id, actorUserId: actorId, status: 'out_for_delivery', driverId, assetId: vehicleId, dispatchRunId: runId, notes,
      });
      const after = (await this.findOne(manager, organizationId, id))!;
      await audit(manager, before, after);
      return { status: 'updated', parcel: after };
    });
  }

  // The driver's run for today (UTC), opened if there is none yet, in one statement: the unique key finds today's run,
  // and LAST_INSERT_ID(id) answers its id instead of a new one. No lock or read order is needed for one run a day.
  private async todaysRun(manager: EntityManager, organizationId: string, driverId: string, actorId: string): Promise<string> {
    const result = await manager.query(
      `INSERT INTO dispatch_runs (organization_id, driver_id, run_date, created_by_user_id) VALUES (?, ?, UTC_DATE(), ?)
         ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
      [organizationId, driverId, actorId],
    );
    return String(result.insertId);
  }

  // Draws waybill numbers until one is free. A refused INSERT undoes only itself, so the transaction carries on.
  private async insertParcel(manager: EntityManager, values: Partial<Parcel>): Promise<string> {
    for (let attempt = 1; ; attempt++) {
      try {
        const { identifiers } = await manager.insert(Parcel, { ...values, trackingNumber: newTrackingNumber() });
        return String(identifiers[0]?.id);
      } catch (error) {
        if (!isDuplicateKey(error) || attempt === TRACKING_ATTEMPTS) throw error;
      }
    }
  }

  private async events(parcelId: string): Promise<ParcelEventRecord[]> {
    const rows: Row[] = await this.database.query(
      `SELECT event.id, event.status, event.event_timestamp AS at, event.hub_location AS hubLocation,
              event.reason_code AS reasonCode, event.notes,
              actor.id AS actorId, actor.username AS actorUsername, actor.display_name AS actorDisplayName,
              ${DRIVER_COLUMNS('driver')}, ${VEHICLE_COLUMNS}, ${RUN_COLUMNS}
         FROM parcel_events event
         LEFT JOIN users actor ON actor.id = event.actor_user_id
         LEFT JOIN employees driver ON driver.id = event.driver_id
         LEFT JOIN assets vehicle ON vehicle.id = event.asset_id
         LEFT JOIN dispatch_runs run ON run.id = event.dispatch_run_id
        WHERE event.parcel_id = ?
        ORDER BY event.event_timestamp, event.id`,
      [parcelId],
    );
    return rows.map(toEvent);
  }

  // `lock` holds the parcel's row until the transaction ends.
  private async findOne(manager: EntityManager, organizationId: string, id: string, lock = false): Promise<ParcelRecord | null> {
    if (lock) await manager.query('SELECT id FROM parcels WHERE id = ? AND organization_id = ? FOR UPDATE', [id, organizationId]);
    const [row] = await manager.query(`${PARCEL_SELECT} AND parcel.id = ?`, [organizationId, id]);
    return row ? toRecord(row) : null;
  }
}

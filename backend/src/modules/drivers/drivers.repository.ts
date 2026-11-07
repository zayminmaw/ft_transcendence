import { Injectable } from '@nestjs/common';
import { Brackets, DataSource, type EntityManager } from 'typeorm';
import { isDuplicateKey } from '../../common/database-errors';
import { containsPattern } from '../../common/like-pattern';
import { COURIER_FIELDS, DRIVER_ROLE, EMPLOYEE_FIELDS, EXPIRY_WARNING_DAYS } from './constants';
import { planUpdate, type RuleRefusal } from './driver-rules';
import { DeliveryDriver, type DispatchStatus } from './entities/delivery-driver.entity';
import { Employee } from './entities/employee.entity';
import type { DriverAccount, DriverChanges, DriverChoice, DriverCounts, DriverRecord, DriverValues } from './types/driver';
import type { ListDriversQueryDto } from './dto/driver.dto';

// Writes its audit row with the change's own manager, so both are saved or neither.
export type AuditStep = (manager: EntityManager, before: DriverRecord | null, after: DriverRecord) => Promise<void>;

// The per-company unique keys a write can meet, and the refusal each one means.
const UNIQUE_KEYS = { uq_org_employee_code: 'code_taken', uq_driver_org_license: 'license_taken', uq_emp_org_user: 'account_taken' } as const;
type Conflict = (typeof UNIQUE_KEYS)[keyof typeof UNIQUE_KEYS];

type Saved = { status: 'created' | 'updated' | 'unchanged'; driver: DriverRecord };
// Every answer of a change: the saved driver, or the refusal it ended in.
export type DriverResult = Saved | { status: Conflict | RuleRefusal | 'not_found' | 'account_not_linkable' };

const SORT_COLUMNS = { lastName: 'employee.lastName', employeeCode: 'employee.employeeCode', hireDate: 'employee.hireDate' } as const;
const SEARCHED = ['employee.employeeCode', 'employee.personalMobile', 'driver.assignedZone', "CONCAT(employee.firstName, ' ', employee.lastName)"];

// Active members of a company (first parameter) with a role (second), as { userId, username }.
const MEMBERS_WITH_ROLE = `
  SELECT account.id AS userId, account.username AS username
    FROM organization_members member
    JOIN roles role ON role.id = member.role_id
    JOIN users account ON account.id = member.user_id
   WHERE member.organization_id = ? AND role.code = ? AND member.is_active = TRUE AND account.is_active = TRUE`;

function pick<T extends object, K extends keyof T>(source: T, fields: readonly K[]): Partial<Pick<T, K>> {
  const result: Partial<Pick<T, K>> = {};
  for (const field of fields) if (source[field] !== undefined) result[field] = source[field];
  return result;
}

// The unique key a failed write ran into, as its refusal; null for any other error.
function conflictOf(error: unknown): Conflict | null {
  if (!isDuplicateKey(error)) return null;
  const message = error instanceof Error ? error.message : '';
  const key = Object.keys(UNIQUE_KEYS).find((name) => message.includes(name)) as keyof typeof UNIQUE_KEYS | undefined;
  return key ? UNIQUE_KEYS[key] : null;
}

function toRecord(employee: Employee): DriverRecord {
  const driver = employee.driver!;
  return {
    ...(pick(employee, EMPLOYEE_FIELDS) as Pick<Employee, (typeof EMPLOYEE_FIELDS)[number]>),
    ...(pick(driver, COURIER_FIELDS) as Pick<DeliveryDriver, (typeof COURIER_FIELDS)[number]>),
    id: employee.id,
    dispatchStatus: driver.dispatchStatus,
    lastLocationPing: driver.lastLocationPing,
    account: employee.user ? { userId: employee.user.id, username: employee.user.username } : null,
    createdAt: employee.createdAt,
    updatedAt: employee.updatedAt,
  };
}

// Both rows of a new driver, in the caller's transaction (the API's create and the demo seed). Off duty and without
// an account unless told otherwise. Returns the employee id.
export async function insertDriver(
  manager: EntityManager,
  organizationId: string,
  values: DriverValues,
  extra: { userId?: string | null; dispatchStatus?: DispatchStatus } = {},
): Promise<string> {
  const { identifiers } = await manager.insert(Employee, {
    ...pick(values, EMPLOYEE_FIELDS), organizationId, userId: extra.userId ?? null, personnelType: 'driver', department: 'field_logistics',
  });
  const employeeId = String(identifiers[0]?.id);
  await manager.insert(DeliveryDriver, {
    ...pick(values, COURIER_FIELDS), employeeId, organizationId, ...(extra.dispatchStatus && { dispatchStatus: extra.dispatchStatus }),
  });
  return employeeId;
}

// The drivers of one company: an `employees` row and its `delivery_drivers` row, always written together. Every
// query and change is scoped to the company; an id from another company is simply not found. A taken employee code,
// license number or account is refused by the per-company unique keys: the transaction rolls back, audit row included.
@Injectable()
export class DriversRepository {
  constructor(private readonly database: DataSource) {}

  // Every value is a parameter and the sort comes from SORT_COLUMNS; the id breaks ties, so pages never overlap. The
  // joins are one-to-one, so plain offset/limit pages correctly.
  async list(organizationId: string, query: ListDriversQueryDto): Promise<{ items: DriverRecord[]; total: number }> {
    const builder = this.drivers(this.database.manager, organizationId);
    if (query.search) {
      const pattern = containsPattern(query.search);
      builder.andWhere(new Brackets((where) => {
        for (const column of SEARCHED) where.orWhere(`${column} LIKE :pattern`, { pattern });
      }));
    }
    if (query.status !== 'all') builder.andWhere('driver.dispatchStatus = :status', { status: query.status });
    const direction = query.direction === 'desc' ? 'DESC' : 'ASC';
    const [rows, total] = await builder
      .orderBy(SORT_COLUMNS[query.sort], direction)
      .addOrderBy('employee.id', direction)
      .offset((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .getManyAndCount();
    return { items: rows.map(toRecord), total };
  }

  // Over the whole company, whatever the search and filter, leaving out terminated drivers. A license expiring
  // within EXPIRY_WARNING_DAYS, or already expired, counts as expiring.
  async counts(organizationId: string): Promise<DriverCounts> {
    const row = await this.database.getRepository(DeliveryDriver).createQueryBuilder('driver')
      .innerJoin('driver.employee', 'employee')
      .select('COUNT(*)', 'total')
      .addSelect("COALESCE(SUM(driver.dispatchStatus = 'available'), 0)", 'available')
      .addSelect("COALESCE(SUM(driver.dispatchStatus IN ('on_pickup', 'out_for_delivery')), 0)", 'onRun')
      .addSelect("COALESCE(SUM(driver.dispatchStatus = 'off_duty'), 0)", 'offDuty')
      .addSelect("COALESCE(SUM(driver.dispatchStatus = 'suspended'), 0)", 'suspended')
      .addSelect('COALESCE(SUM(driver.licenseExpiryDate <= CURDATE() + INTERVAL :days DAY), 0)', 'licensesExpiring')
      .where('driver.organizationId = :organizationId', { organizationId })
      .andWhere("employee.employmentStatus <> 'terminated'")
      .setParameter('days', EXPIRY_WARNING_DAYS)
      .getRawOne<Record<keyof DriverCounts, string>>();
    // An aggregate without GROUP BY always answers one row; the drivers answer numbers as strings.
    return Object.fromEntries(Object.entries(row!).map(([name, value]) => [name, Number(value)])) as unknown as DriverCounts;
  }

  // Everyone still employed, by name.
  async choices(organizationId: string): Promise<DriverChoice[]> {
    const rows = await this.database.getRepository(Employee).createQueryBuilder('employee')
      .innerJoin('employee.driver', 'driver')
      .select(['employee.id', 'employee.firstName', 'employee.lastName', 'employee.employeeCode'])
      .where('employee.organizationId = :organizationId', { organizationId })
      .andWhere("employee.employmentStatus <> 'terminated'")
      .orderBy('employee.lastName', 'ASC')
      .addOrderBy('employee.firstName', 'ASC')
      .addOrderBy('employee.id', 'ASC')
      .getMany();
    return rows.map((row) => ({ id: row.id, name: `${row.firstName} ${row.lastName}`, employeeCode: row.employeeCode }));
  }

  find(organizationId: string, id: string): Promise<DriverRecord | null> {
    return this.findOne(this.database.manager, organizationId, id);
  }

  // Active members with the driver role who aren't linked to a driver of this company yet, by username.
  linkableAccounts(organizationId: string): Promise<DriverAccount[]> {
    return this.database.query(
      `${MEMBERS_WITH_ROLE} AND NOT EXISTS (
         SELECT 1 FROM employees employee WHERE employee.organization_id = member.organization_id AND employee.user_id = member.user_id
       )
       ORDER BY account.username`,
      [organizationId, DRIVER_ROLE],
    );
  }

  create(organizationId: string, values: DriverValues, audit: AuditStep): Promise<DriverResult> {
    return this.refusable(async (manager) => {
      const id = await insertDriver(manager, organizationId, values);
      const driver = (await this.findOne(manager, organizationId, id))!;
      await audit(manager, null, driver);
      return { status: 'created', driver };
    });
  }

  // Locks the driver, so two edits at once run one after the other and each audits what it really changed. What
  // changes, and whether it may, is planUpdate's decision.
  update(organizationId: string, id: string, changes: DriverChanges, audit: AuditStep): Promise<DriverResult> {
    return this.refusable(async (manager) => {
      const before = await this.findOne(manager, organizationId, id, true);
      if (!before) return { status: 'not_found' };
      const plan = planUpdate(before, changes);
      if ('refusal' in plan) return { status: plan.refusal };
      const { changed } = plan;
      if (Object.keys(changed).length === 0) return { status: 'unchanged', driver: before };
      const courier = pick(changed, [...COURIER_FIELDS, 'dispatchStatus'] as const);
      if (Object.keys(courier).length > 0) await manager.update(DeliveryDriver, { organizationId, employeeId: id }, courier);
      // Always written, so updated_at moves when only the courier row changed.
      await manager.update(Employee, { organizationId, id }, { ...pick(changed, EMPLOYEE_FIELDS), updatedAt: () => 'CURRENT_TIMESTAMP' });
      const after = (await this.findOne(manager, organizationId, id))!;
      await audit(manager, before, after);
      return { status: 'updated', driver: after };
    });
  }

  // Links an account (only an active driver-role member of the company) or unlinks it (null).
  linkAccount(organizationId: string, id: string, userId: string | null, audit: AuditStep): Promise<DriverResult> {
    return this.refusable(async (manager) => {
      const before = await this.findOne(manager, organizationId, id, true);
      if (!before) return { status: 'not_found' };
      if ((before.account?.userId ?? null) === userId) return { status: 'unchanged', driver: before };
      if (userId) {
        const [member] = await manager.query(`${MEMBERS_WITH_ROLE} AND member.user_id = ? FOR UPDATE`, [organizationId, DRIVER_ROLE, userId]);
        if (!member) return { status: 'account_not_linkable' };
      }
      await manager.update(Employee, { organizationId, id }, { userId });
      const after = (await this.findOne(manager, organizationId, id))!;
      await audit(manager, before, after);
      return { status: 'updated', driver: after };
    });
  }

  private drivers(manager: EntityManager, organizationId: string) {
    return manager.getRepository(Employee).createQueryBuilder('employee')
      .innerJoinAndSelect('employee.driver', 'driver')
      .leftJoin('employee.user', 'user')
      .addSelect(['user.id', 'user.username'])
      .where('employee.organizationId = :organizationId', { organizationId });
  }

  // `lock` holds the rows until the transaction ends.
  private async findOne(manager: EntityManager, organizationId: string, id: string, lock = false): Promise<DriverRecord | null> {
    const builder = this.drivers(manager, organizationId).andWhere('employee.id = :id', { id });
    if (lock) builder.setLock('pessimistic_write');
    const employee = await builder.getOne();
    return employee ? toRecord(employee) : null;
  }

  // Runs the change in a transaction; a write refused by a unique key ends in that key's refusal instead.
  private async refusable(work: (manager: EntityManager) => Promise<DriverResult>): Promise<DriverResult> {
    try {
      return await this.database.transaction(work);
    } catch (error) {
      const status = conflictOf(error);
      if (status) return { status };
      throw error;
    }
  }
}

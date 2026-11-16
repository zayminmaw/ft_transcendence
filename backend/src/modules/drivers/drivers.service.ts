import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { RequestMeta } from '../../common/context/request-meta';
import { ID_PATTERN } from '../../common/ids';
import type { TenantContext } from '../../common/types/authenticated-request';
import { type AuditAction, AuditService } from '../audit';
import { PermissionPolicyService } from '../rbac';
import {
  ACCOUNT_ALREADY_LINKED, ACCOUNT_NOT_LINKABLE, BASE_FIELDS, DRIVER_NOT_FOUND, DRIVER_PAYROLL_FORBIDDEN, DRIVER_TERMINATED,
  DRIVER_TERMINATION_DATE_REQUIRED, EMPLOYEE_CODE_TAKEN, FIELD_GROUPS, type FieldGroup, LICENSE_NUMBER_TAKEN,
  type MANUAL_DISPATCH_STATUSES,
} from './constants';
import { missingTerminationDate } from './driver-rules';
import { type AuditStep, type DriverResult, DriversRepository } from './drivers.repository';
import type { CreateDriverDto, ListDriversQueryDto, UpdateDriverDto } from './dto/driver.dto';
import type { DriverRecord, DriverValues, DriverView } from './types/driver';

// Who is asking: the verified company and role, and the account, for the audit row.
export interface DriversActor {
  tenant: TenantContext;
  userId: string;
  meta: RequestMeta;
}

type Seen = Record<FieldGroup, boolean>;
type Refusal = Exclude<DriverResult['status'], 'created' | 'updated' | 'unchanged'>;

const REFUSALS: Record<Refusal, () => Error> = {
  not_found: () => new NotFoundException(DRIVER_NOT_FOUND),
  code_taken: () => new ConflictException(EMPLOYEE_CODE_TAKEN),
  license_taken: () => new ConflictException(LICENSE_NUMBER_TAKEN),
  termination_date_required: () => new BadRequestException(DRIVER_TERMINATION_DATE_REQUIRED),
  terminated: () => new ConflictException(DRIVER_TERMINATED),
  account_taken: () => new ConflictException(ACCOUNT_ALREADY_LINKED),
  account_not_linkable: () => new BadRequestException(ACCOUNT_NOT_LINKABLE),
};

// The saved driver of a change, or the refusal it ended in.
function savedDriver(result: DriverResult): DriverRecord {
  if ('driver' in result) return result.driver;
  throw REFUSALS[result.status]();
}

// The base fields for anyone with drivers.view, plus each group the person's role may see. Listed field by field
// (constants), so a new column is never answered by accident.
function publicDriver(driver: DriverRecord, seen: Seen): DriverView {
  const view: Record<string, unknown> = {};
  const copy = (fields: readonly string[]) => {
    for (const field of fields) view[field] = driver[field as keyof DriverRecord];
  };
  copy(BASE_FIELDS);
  for (const group of Object.keys(FIELD_GROUPS) as FieldGroup[]) if (seen[group]) copy(FIELD_GROUPS[group].fields);
  return view as DriverView;
}

const AMOUNT_FIELDS = ['baseSalary', 'maxWeightCapacityKg', 'maxVolumeCapacityM3', 'commissionPerDrop'] as const;

// The fields sent, without the ones left out (a DTO instance holds them as undefined), and the amounts as saved
// however they were typed ("1.5" is saved as 1.50), so an unchanged amount isn't a change.
function sentValues<T extends object>(body: T): Partial<T> {
  const amounts: readonly string[] = AMOUNT_FIELDS;
  return Object.fromEntries(Object.entries(body)
    .filter(([, value]) => value !== undefined)
    .map(([field, value]) => [field, amounts.includes(field) ? Number(value).toFixed(2) : value])) as Partial<T>;
}

// What a new driver gets for each optional field left out: active, no pay, no zone or capacity, not yet checked.
const CREATE_DEFAULTS = {
  employmentStatus: 'active', terminationDate: null, baseSalary: '0.00', bankName: null, bankAccountIban: null, assignedZone: null,
  maxWeightCapacityKg: '0.00', maxVolumeCapacityM3: '0.00', commissionPerDrop: '0.00', backgroundCheckPassed: false,
  backgroundCheckDate: null, transitInsurancePolicy: null, transitInsuranceExpiry: null,
} as const satisfies Partial<DriverValues>;

// A malformed id names no driver, like an unknown one.
function requireId(id: string) {
  if (!ID_PATTERN.test(id)) throw new NotFoundException(DRIVER_NOT_FOUND);
}

// The couriers of the open company. The company always comes from the verified tenant context, never from the
// request.
@Injectable()
export class DriversService {
  constructor(
    private readonly drivers: DriversRepository,
    private readonly policy: PermissionPolicyService,
    private readonly audit: AuditService,
  ) {}

  async list(tenant: TenantContext, query: ListDriversQueryDto) {
    const [page, counts, seen] = await Promise.all([
      this.drivers.list(tenant.organizationId, query),
      this.drivers.counts(tenant.organizationId),
      this.seen(tenant),
    ]);
    return {
      items: page.items.map((driver) => publicDriver(driver, seen)),
      total: page.total,
      page: query.page,
      pageSize: query.pageSize,
      counts,
    };
  }

  choices(tenant: TenantContext) {
    return this.drivers.choices(tenant.organizationId);
  }

  linkableAccounts(tenant: TenantContext) {
    return this.drivers.linkableAccounts(tenant.organizationId);
  }

  async get(tenant: TenantContext, id: string) {
    requireId(id);
    const [driver, seen] = await Promise.all([this.drivers.find(tenant.organizationId, id), this.seen(tenant)]);
    if (!driver) throw new NotFoundException(DRIVER_NOT_FOUND);
    return publicDriver(driver, seen);
  }

  async create(actor: DriversActor, body: CreateDriverDto) {
    const seen = await this.requirePayrollAccess(actor.tenant, body);
    const values = { ...CREATE_DEFAULTS, ...sentValues(body) } as DriverValues;
    if (missingTerminationDate(values)) throw REFUSALS.termination_date_required();
    const result = await this.drivers.create(actor.tenant.organizationId, values, this.auditStep(actor, 'create'));
    return publicDriver(savedDriver(result), seen);
  }

  // Ending employment also takes the driver off duty.
  async update(actor: DriversActor, id: string, body: UpdateDriverDto) {
    requireId(id);
    const seen = await this.requirePayrollAccess(actor.tenant, body);
    const result = await this.drivers.update(actor.tenant.organizationId, id, sentValues(body), this.auditStep(actor, 'update'));
    return publicDriver(savedDriver(result), seen);
  }

  // By hand: available, off duty or suspended. A terminated driver stays off duty.
  async setDispatchStatus(actor: DriversActor, id: string, dispatchStatus: (typeof MANUAL_DISPATCH_STATUSES)[number]) {
    requireId(id);
    const [result, seen] = await Promise.all([
      this.drivers.update(actor.tenant.organizationId, id, { dispatchStatus }, this.auditStep(actor, 'status_change')),
      this.seen(actor.tenant),
    ]);
    return publicDriver(savedDriver(result), seen);
  }

  // Links the account the driver signs in with, or unlinks it (null).
  async linkAccount(actor: DriversActor, id: string, userId: string | null) {
    requireId(id);
    const [result, seen] = await Promise.all([
      this.drivers.linkAccount(actor.tenant.organizationId, id, userId, this.auditStep(actor, userId ? 'assign' : 'revoke')),
      this.seen(actor.tenant),
    ]);
    return publicDriver(savedDriver(result), seen);
  }

  // Which field groups the role may see, in one permission lookup.
  private async seen(tenant: TenantContext): Promise<Seen> {
    const groups = Object.keys(FIELD_GROUPS) as FieldGroup[];
    const allowed = await this.policy.allowedOf(tenant.roleId, groups.map((group) => FIELD_GROUPS[group].permission));
    return Object.fromEntries(groups.map((group) => [group, allowed.has(FIELD_GROUPS[group].permission)])) as Seen;
  }

  // Pay and bank details are payroll: refused rather than ignored, so nobody believes they were saved.
  private async requirePayrollAccess(tenant: TenantContext, body: CreateDriverDto | UpdateDriverDto): Promise<Seen> {
    const seen = await this.seen(tenant);
    const sendsPayroll = FIELD_GROUPS.payroll.fields.some((field) => body[field] !== undefined);
    if (sendsPayroll && !seen.payroll) throw new ForbiddenException(DRIVER_PAYROLL_FORBIDDEN);
    return seen;
  }

  // The audit row for a change, written in the change's transaction. A duty status change stores only the status;
  // linking stores only the account.
  private auditStep(actor: DriversActor, action: AuditAction): AuditStep {
    const snapshot = (driver: DriverRecord | null) => {
      if (!driver) return null;
      if (action === 'status_change') return { dispatchStatus: driver.dispatchStatus };
      if (action === 'assign' || action === 'revoke') return { account: driver.account };
      // Stored as backgroundCheck: "pass" in a key reads as a secret to the redaction rules.
      const { backgroundCheckPassed, ...rest } = driver;
      return { ...rest, backgroundCheck: backgroundCheckPassed };
    };
    return (manager: EntityManager, before: DriverRecord | null, after: DriverRecord) => this.audit.record(manager, {
      module: 'drivers',
      action,
      resourceType: 'driver',
      recordId: after.id,
      resourceLabel: after.employeeCode,
      organizationId: actor.tenant.organizationId,
      actorId: actor.userId,
      before: snapshot(before),
      after: snapshot(after),
      meta: actor.meta,
    });
  }
}

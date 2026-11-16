import { applyDecorators } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsBoolean, IsDefined, IsIn, IsInt, IsISO8601, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min, ValidateIf,
} from 'class-validator';
import { IsOmittable, Trim, TrimOrNull, TrimUpper } from '../../../common/decorators/trim.decorator';
import { ID_PATTERN } from '../../../common/ids';
import { PAGE_SIZES } from '../../../common/paging';
import { EMAIL_MAX_LENGTH, EMAIL_PATTERN } from '../../users/account-rules';
import { DRIVER_SORTS, DRIVER_STATUS_FILTERS, MANUAL_DISPATCH_STATUSES } from '../constants';
import { DRIVER_CATEGORIES, FLEET_ARRANGEMENTS } from '../entities/delivery-driver.entity';
import { COMPENSATION_TYPES, EMPLOYMENT_CLASSIFICATIONS, EMPLOYMENT_STATUSES } from '../entities/employee.entity';

// The same rules as the driver form (frontend driverSchema) and the `employees` / `delivery_drivers` columns. Each
// field's rule is written once and shared by both DTOs; the update DTO adds IsOmittable to the required ones.
const PHONE_PATTERN = /^\+?[0-9 ()-]{6,32}$/;
// DECIMAL(12, 2) for money, DECIMAL(8, 2) for capacities: sent as strings, never as JS numbers.
const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;
const CAPACITY_PATTERN = /^\d{1,6}(\.\d{1,2})?$/;

const RequiredText = (max: number) => applyDecorators(Trim(), IsString(), IsNotEmpty(), MaxLength(max));
const OptionalText = (max: number) => applyDecorators(TrimOrNull(), IsOptional(), IsString(), MaxLength(max));
const Phone = () => applyDecorators(Trim(), IsString(), Matches(PHONE_PATTERN, { message: '$property must be a phone number' }));
// 'YYYY-MM-DD', like the DATE columns, and a real day (no 2026-02-30).
const Day = () => applyDecorators(
  IsString(), Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '$property must be a YYYY-MM-DD date' }), IsISO8601({ strict: true }),
);
const OptionalDay = () => applyDecorators(TrimOrNull(), IsOptional(), Day());
const Amount = (pattern: RegExp) => applyDecorators(
  Trim(), IsString(), Matches(pattern, { message: '$property must be an amount with at most 2 decimals' }),
);

const EmployeeCode = () => applyDecorators(
  TrimUpper(), IsString(), Matches(/^[A-Z0-9-]{2,32}$/, { message: 'employeeCode must be 2-32 capital letters, numbers or dashes' }),
);
const Email = () => applyDecorators(
  Trim(), IsString(), MaxLength(EMAIL_MAX_LENGTH), Matches(EMAIL_PATTERN, { message: 'personalEmail must be an email address' }),
);

export class CreateDriverDto {
  @EmployeeCode() employeeCode!: string;
  @RequiredText(64) firstName!: string;
  @RequiredText(64) lastName!: string;
  @Phone() personalMobile!: string;
  @Email() personalEmail!: string;
  @RequiredText(64) nationalId!: string;
  @Day() dateOfBirth!: string;
  @RequiredText(2000) residentialAddress!: string;
  @RequiredText(128) emergencyContactName!: string;
  @Phone() emergencyContactPhone!: string;
  @IsIn(EMPLOYMENT_CLASSIFICATIONS) employmentClassification!: (typeof EMPLOYMENT_CLASSIFICATIONS)[number];
  @IsIn(COMPENSATION_TYPES) compensationType!: (typeof COMPENSATION_TYPES)[number];
  // Left out, a new driver is active.
  @IsOptional() @IsIn(EMPLOYMENT_STATUSES) employmentStatus?: (typeof EMPLOYMENT_STATUSES)[number];
  @Day() hireDate!: string;
  @OptionalDay() terminationDate?: string | null;
  // Only with staff.view_payroll (checked by the service). Left out: no salary and no bank details.
  @IsOptional() @Amount(MONEY_PATTERN) baseSalary?: string;
  @OptionalText(128) bankName?: string | null;
  @OptionalText(64) bankAccountIban?: string | null;
  @IsIn(DRIVER_CATEGORIES) driverCategory!: (typeof DRIVER_CATEGORIES)[number];
  @IsIn(FLEET_ARRANGEMENTS) fleetArrangement!: (typeof FLEET_ARRANGEMENTS)[number];
  @OptionalText(64) assignedZone?: string | null;
  @IsOptional() @Amount(CAPACITY_PATTERN) maxWeightCapacityKg?: string;
  @IsOptional() @Amount(CAPACITY_PATTERN) maxVolumeCapacityM3?: string;
  @IsOptional() @Amount(MONEY_PATTERN) commissionPerDrop?: string;
  @RequiredText(64) licenseNumber!: string;
  @RequiredText(32) licenseClass!: string;
  @Day() licenseExpiryDate!: string;
  @IsOptional() @IsBoolean() backgroundCheckPassed?: boolean;
  @OptionalDay() backgroundCheckDate?: string | null;
  @OptionalText(64) transitInsurancePolicy?: string | null;
  @OptionalDay() transitInsuranceExpiry?: string | null;
}

// Every field may be left out and keeps its value. The duty status and the account have their own endpoints.
export class UpdateDriverDto {
  @IsOmittable() @EmployeeCode() employeeCode?: string;
  @IsOmittable() @RequiredText(64) firstName?: string;
  @IsOmittable() @RequiredText(64) lastName?: string;
  @IsOmittable() @Phone() personalMobile?: string;
  @IsOmittable() @Email() personalEmail?: string;
  @IsOmittable() @RequiredText(64) nationalId?: string;
  @IsOmittable() @Day() dateOfBirth?: string;
  @IsOmittable() @RequiredText(2000) residentialAddress?: string;
  @IsOmittable() @RequiredText(128) emergencyContactName?: string;
  @IsOmittable() @Phone() emergencyContactPhone?: string;
  @IsOmittable() @IsIn(EMPLOYMENT_CLASSIFICATIONS) employmentClassification?: (typeof EMPLOYMENT_CLASSIFICATIONS)[number];
  @IsOmittable() @IsIn(COMPENSATION_TYPES) compensationType?: (typeof COMPENSATION_TYPES)[number];
  @IsOmittable() @IsIn(EMPLOYMENT_STATUSES) employmentStatus?: (typeof EMPLOYMENT_STATUSES)[number];
  @IsOmittable() @Day() hireDate?: string;
  @OptionalDay() terminationDate?: string | null;
  @IsOmittable() @Amount(MONEY_PATTERN) baseSalary?: string;
  @OptionalText(128) bankName?: string | null;
  @OptionalText(64) bankAccountIban?: string | null;
  @IsOmittable() @IsIn(DRIVER_CATEGORIES) driverCategory?: (typeof DRIVER_CATEGORIES)[number];
  @IsOmittable() @IsIn(FLEET_ARRANGEMENTS) fleetArrangement?: (typeof FLEET_ARRANGEMENTS)[number];
  @OptionalText(64) assignedZone?: string | null;
  @IsOmittable() @Amount(CAPACITY_PATTERN) maxWeightCapacityKg?: string;
  @IsOmittable() @Amount(CAPACITY_PATTERN) maxVolumeCapacityM3?: string;
  @IsOmittable() @Amount(MONEY_PATTERN) commissionPerDrop?: string;
  @IsOmittable() @RequiredText(64) licenseNumber?: string;
  @IsOmittable() @RequiredText(32) licenseClass?: string;
  @IsOmittable() @Day() licenseExpiryDate?: string;
  @IsOmittable() @IsBoolean() backgroundCheckPassed?: boolean;
  @OptionalDay() backgroundCheckDate?: string | null;
  @OptionalText(64) transitInsurancePolicy?: string | null;
  @OptionalDay() transitInsuranceExpiry?: string | null;
}

export class DutyStatusDto {
  @IsIn(MANUAL_DISPATCH_STATUSES)
  dispatchStatus!: (typeof MANUAL_DISPATCH_STATUSES)[number];
}

// null unlinks the account.
export class LinkAccountDto {
  @IsDefined() @ValidateIf((_object: object, value: unknown) => value !== null)
  @IsString() @Matches(ID_PATTERN, { message: 'userId must be an id' })
  userId!: string | null;
}

export class ListDriversQueryDto {
  @Trim() @IsOptional() @IsString() @MaxLength(100)
  search?: string;

  @IsOptional() @IsIn(DRIVER_STATUS_FILTERS)
  status: (typeof DRIVER_STATUS_FILTERS)[number] = 'all';

  @IsOptional() @IsIn(DRIVER_SORTS)
  sort: (typeof DRIVER_SORTS)[number] = 'lastName';

  @IsOptional() @IsIn(['asc', 'desc'])
  direction: 'asc' | 'desc' = 'asc';

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page = 1;

  @IsOptional() @Type(() => Number) @IsIn(PAGE_SIZES)
  pageSize = 10;
}

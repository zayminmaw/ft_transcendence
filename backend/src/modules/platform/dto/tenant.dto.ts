import { Transform, Type } from 'class-transformer';
import { IsDefined, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min, ValidateIf, ValidateNested } from 'class-validator';
import { Trim } from '../../../common/decorators/trim.decorator';
import { EMAIL_MAX_LENGTH, EMAIL_PATTERN, USERNAME_PATTERN } from '../../users/account-rules';
import { REVOKE_OUTCOMES } from '../constants';

// Left out means unchanged; null is refused, because these columns are required.
const IsOmittable = () => ValidateIf((_object: object, value: unknown) => value !== undefined);
// An optional detail sent as "" is cleared, like one sent as null.
const trimOrNull = () => Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || null : value));

// BIGINT ids in the URL and body.
export const ID_PATTERN = /^[1-9]\d{0,19}$/;

// The company's URL name (/app/<slug>): lower-case words joined by single dashes.
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class TenantOrganizationDto {
  @Trim() @IsString() @IsNotEmpty() @MaxLength(191)
  name!: string;

  @Trim() @IsString() @MaxLength(64)
  @Matches(SLUG_PATTERN, { message: 'slug must be lower-case letters and numbers joined by single dashes' })
  slug!: string;

  @Trim() @IsString() @MaxLength(EMAIL_MAX_LENGTH) @Matches(EMAIL_PATTERN, { message: 'contactEmail must be an email address' })
  contactEmail!: string;

  @trimOrNull() @IsOptional() @IsString() @MaxLength(32)
  contactPhone?: string | null;

  @trimOrNull() @IsOptional() @IsString() @MaxLength(1000)
  address?: string | null;
}

export class TenantAdministratorDto {
  @Trim() @IsString() @Matches(USERNAME_PATTERN, { message: 'username must be 3-64 letters, numbers, dots, dashes or underscores' })
  username!: string;

  @Trim() @IsString() @MaxLength(EMAIL_MAX_LENGTH) @Matches(EMAIL_PATTERN, { message: 'email must be an email address' })
  email!: string;

  // The password rule itself is checked by the service, so the message matches the other account forms.
  @IsString() @IsNotEmpty() @MaxLength(128)
  password!: string;
}

export class CreateTenantDto {
  @IsDefined() @ValidateNested() @Type(() => TenantOrganizationDto)
  organization!: TenantOrganizationDto;

  @IsDefined() @ValidateNested() @Type(() => TenantAdministratorDto)
  administrator!: TenantAdministratorDto;
}

// The slug is left out on purpose: it is in every company URL, so changing it would break links and bookmarks.
export class UpdateTenantDto {
  @Trim() @IsOmittable() @IsString() @IsNotEmpty() @MaxLength(191)
  name?: string;

  @Trim() @IsOmittable() @IsString() @MaxLength(EMAIL_MAX_LENGTH) @Matches(EMAIL_PATTERN, { message: 'contactEmail must be an email address' })
  contactEmail?: string;

  @trimOrNull() @IsOptional() @IsString() @MaxLength(32)
  contactPhone?: string | null;

  @trimOrNull() @IsOptional() @IsString() @MaxLength(1000)
  address?: string | null;
}

export class SuspendTenantDto {
  @Trim() @IsString() @IsNotEmpty() @MaxLength(500)
  reason!: string;
}

export class ReactivateTenantDto {
  @trimOrNull() @IsOptional() @IsString() @MaxLength(500)
  reason?: string | null;
}

// A new account (account) or an existing member of the company (userId); only the mode's own field is read.
export class AssignAdministratorDto {
  @IsIn(['new', 'existing'])
  mode!: 'new' | 'existing';

  @ValidateIf((body: AssignAdministratorDto) => body.mode === 'new')
  @IsDefined() @ValidateNested() @Type(() => TenantAdministratorDto)
  account?: TenantAdministratorDto;

  @ValidateIf((body: AssignAdministratorDto) => body.mode === 'existing')
  @IsString() @Matches(ID_PATTERN, { message: 'userId must be a positive integer' })
  userId?: string;
}

export class SearchMembersQueryDto {
  @Trim() @IsOptional() @IsString() @MaxLength(100)
  search?: string;
}

export class RevokeAdministratorDto {
  @IsIn(REVOKE_OUTCOMES)
  outcome!: (typeof REVOKE_OUTCOMES)[number];

  @ValidateIf((body: RevokeAdministratorDto) => body.outcome === 'change_role')
  // Checked against the database when revoking.
  @Trim() @IsString() @IsNotEmpty() @MaxLength(64)
  roleCode?: string;

  @Trim() @IsString() @IsNotEmpty() @MaxLength(500)
  reason!: string;
}

export const TENANT_STATUSES = ['all', 'active', 'suspended'] as const;
export const TENANT_SORTS = ['name', 'members', 'createdAt'] as const;
export const PAGE_SIZES = [10, 25, 50];

export class ListTenantsQueryDto {
  @Trim() @IsOptional() @IsString() @MaxLength(100)
  search?: string;

  @IsOptional() @IsIn(TENANT_STATUSES)
  status: (typeof TENANT_STATUSES)[number] = 'all';

  @IsOptional() @IsIn(TENANT_SORTS)
  sort: (typeof TENANT_SORTS)[number] = 'name';

  @IsOptional() @IsIn(['asc', 'desc'])
  direction: 'asc' | 'desc' = 'asc';

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page = 1;

  @IsOptional() @Type(() => Number) @IsIn(PAGE_SIZES)
  pageSize = 10;
}

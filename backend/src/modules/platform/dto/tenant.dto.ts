import { Transform, Type } from 'class-transformer';
import { IsDefined, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min, ValidateIf, ValidateNested } from 'class-validator';
import { EMAIL_MAX_LENGTH, EMAIL_PATTERN, USERNAME_PATTERN } from '../../users/account-rules';

const trim = () => Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));
// Left out means unchanged; null is refused, because these columns are required.
const IsOmittable = () => ValidateIf((_object: object, value: unknown) => value !== undefined);
// An optional detail sent as "" is cleared, like one sent as null.
const trimOrNull = () => Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || null : value));

// The company's URL name (/app/<slug>): lower-case words joined by single dashes.
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class TenantOrganizationDto {
  @trim() @IsString() @IsNotEmpty() @MaxLength(191)
  name!: string;

  @trim() @IsString() @MaxLength(64)
  @Matches(SLUG_PATTERN, { message: 'slug must be lower-case letters and numbers joined by single dashes' })
  slug!: string;

  @trim() @IsString() @MaxLength(EMAIL_MAX_LENGTH) @Matches(EMAIL_PATTERN, { message: 'contactEmail must be an email address' })
  contactEmail!: string;

  @trimOrNull() @IsOptional() @IsString() @MaxLength(32)
  contactPhone?: string | null;

  @trimOrNull() @IsOptional() @IsString() @MaxLength(1000)
  address?: string | null;
}

export class TenantAdministratorDto {
  @trim() @IsString() @Matches(USERNAME_PATTERN, { message: 'username must be 3-64 letters, numbers, dots, dashes or underscores' })
  username!: string;

  @trim() @IsString() @MaxLength(EMAIL_MAX_LENGTH) @Matches(EMAIL_PATTERN, { message: 'email must be an email address' })
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
  @trim() @IsOmittable() @IsString() @IsNotEmpty() @MaxLength(191)
  name?: string;

  @trim() @IsOmittable() @IsString() @MaxLength(EMAIL_MAX_LENGTH) @Matches(EMAIL_PATTERN, { message: 'contactEmail must be an email address' })
  contactEmail?: string;

  @trimOrNull() @IsOptional() @IsString() @MaxLength(32)
  contactPhone?: string | null;

  @trimOrNull() @IsOptional() @IsString() @MaxLength(1000)
  address?: string | null;
}

export class SuspendTenantDto {
  @trim() @IsString() @IsNotEmpty() @MaxLength(500)
  reason!: string;
}

export class ReactivateTenantDto {
  @trimOrNull() @IsOptional() @IsString() @MaxLength(500)
  reason?: string | null;
}

export const TENANT_STATUSES = ['all', 'active', 'suspended'] as const;
export const TENANT_SORTS = ['name', 'members', 'createdAt'] as const;
export const PAGE_SIZES = [10, 25, 50];

export class ListTenantsQueryDto {
  @trim() @IsOptional() @IsString() @MaxLength(100)
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

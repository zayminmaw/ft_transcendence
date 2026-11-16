import { applyDecorators } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { IsOmittable, Trim, TrimOrNull, TrimUpper } from '../../../common/decorators/trim.decorator';
import { ID_PATTERN } from '../../../common/ids';
import { PAGE_SIZES } from '../../../common/paging';
import {
  ASSET_CATEGORIES, ASSET_CONDITIONS, ASSET_SORTS, ASSET_STATUS_FILTERS, type AssetCategory, type AssetCondition,
  NOTES_MAX_LENGTH, RETURN_CONDITIONS,
} from '../constants';

// The same rules as the asset forms (frontend assetSchema and maintenanceSchema) and the columns.
// DECIMAL(12, 2): sent as a string, never as a JS number.
const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

const RequiredText = (max: number) => applyDecorators(Trim(), IsString(), IsNotEmpty(), MaxLength(max));
const OptionalText = (max: number) => applyDecorators(TrimOrNull(), IsOptional(), IsString(), MaxLength(max));
// 'YYYY-MM-DD', like the DATE columns, and a real day (no 2026-02-30).
const Day = () => applyDecorators(
  IsString(), Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '$property must be a YYYY-MM-DD date' }), IsISO8601({ strict: true }),
);
const OptionalDay = () => applyDecorators(TrimOrNull(), IsOptional(), Day());
const Money = () => applyDecorators(
  Trim(), IsString(), Matches(MONEY_PATTERN, { message: '$property must be an amount with at most 2 decimals' }),
);
const AssetTag = () => applyDecorators(
  TrimUpper(), IsString(), Matches(/^[A-Z0-9-]{2,64}$/, { message: 'assetTag must be 2-64 capital letters, numbers or dashes' }),
);

export class CreateAssetDto {
  @AssetTag() assetTag!: string;
  @RequiredText(128) assetName!: string;
  @IsIn(ASSET_CATEGORIES) category!: AssetCategory;
  // Left out: good, at no cost.
  @IsOptional() @IsIn(ASSET_CONDITIONS) currentCondition?: AssetCondition;
  @IsOptional() @Money() acquisitionCost?: string;
  @IsOptional() @Money() currentBookValue?: string;
  @OptionalText(32) licensePlate?: string | null;
  @OptionalText(64) vin?: string | null;
  @OptionalText(64) insurancePolicyNumber?: string | null;
  @OptionalDay() roadTaxExpiry?: string | null;
  @OptionalText(NOTES_MAX_LENGTH) notes?: string | null;
}

// Every field may be left out and keeps its value. Who has the asset changes only by checking it out and in.
export class UpdateAssetDto {
  @IsOmittable() @AssetTag() assetTag?: string;
  @IsOmittable() @RequiredText(128) assetName?: string;
  @IsOmittable() @IsIn(ASSET_CATEGORIES) category?: AssetCategory;
  @IsOmittable() @IsIn(ASSET_CONDITIONS) currentCondition?: AssetCondition;
  @IsOmittable() @Money() acquisitionCost?: string;
  @IsOmittable() @Money() currentBookValue?: string;
  @OptionalText(32) licensePlate?: string | null;
  @OptionalText(64) vin?: string | null;
  @OptionalText(64) insurancePolicyNumber?: string | null;
  @OptionalDay() roadTaxExpiry?: string | null;
  @OptionalText(NOTES_MAX_LENGTH) notes?: string | null;
}

export class CheckOutDto {
  @IsString() @Matches(ID_PATTERN, { message: 'driverId must be an id' })
  driverId!: string;

  @OptionalText(NOTES_MAX_LENGTH) notes?: string | null;
}

// The condition it came back in.
export class CheckInDto {
  @IsIn(RETURN_CONDITIONS) condition!: (typeof RETURN_CONDITIONS)[number];
  @OptionalText(NOTES_MAX_LENGTH) notes?: string | null;
}

// A service, and the condition the asset left the workshop in.
export class MaintenanceDto {
  @Day() serviceDate!: string;
  @RequiredText(128) serviceType!: string;
  @IsOptional() @Money() serviceCost?: string;
  @OptionalText(128) vendorServiceCenter?: string | null;
  @OptionalDay() nextServiceDue?: string | null;
  @OptionalText(NOTES_MAX_LENGTH) notes?: string | null;
  @IsIn(RETURN_CONDITIONS) condition!: (typeof RETURN_CONDITIONS)[number];
}

export class ListAssetsQueryDto {
  @Trim() @IsOptional() @IsString() @MaxLength(100)
  search?: string;

  @IsOptional() @IsIn(ASSET_STATUS_FILTERS)
  status: (typeof ASSET_STATUS_FILTERS)[number] = 'all';

  @IsOptional() @IsIn(ASSET_SORTS)
  sort: (typeof ASSET_SORTS)[number] = 'assetTag';

  @IsOptional() @IsIn(['asc', 'desc'])
  direction: 'asc' | 'desc' = 'asc';

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page = 1;

  @IsOptional() @Type(() => Number) @IsIn(PAGE_SIZES)
  pageSize = 10;
}

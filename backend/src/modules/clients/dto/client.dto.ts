import { applyDecorators } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsLatitude, IsLongitude, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { Code, OptionalPhone, OptionalText, Phone, RequiredText } from '../../../common/decorators/field-rules.decorator';
import { IsOmittable, Trim, TrimOrNull } from '../../../common/decorators/trim.decorator';
import { PAGE_SIZES } from '../../../common/paging';
import { EMAIL_MAX_LENGTH, EMAIL_PATTERN } from '../../users/account-rules';
import { CLIENT_SORTS, CLIENT_STATUSES, RATE_TIERS, type RateTier } from '../constants';

// The same rules as the client form (frontend clientSchema) and the `clients` columns. Each field's rule is written
// once and shared by both DTOs; the update DTO adds IsOmittable to the required ones.
// At most 8 decimals, like DECIMAL(10, 8) and DECIMAL(11, 8). The range is checked by IsLatitude / IsLongitude.
const COORDINATE_PATTERN = /^-?\d{1,3}(\.\d{1,8})?$/;

const Coordinate = (field: string) => Matches(COORDINATE_PATTERN, { message: `${field} must be a number with at most 8 decimals` });

const Email = () => applyDecorators(
  Trim(), IsString(), MaxLength(EMAIL_MAX_LENGTH), Matches(EMAIL_PATTERN, { message: 'email must be an email address' }),
);
const Latitude = () => applyDecorators(TrimOrNull(), IsOptional(), IsString(), Coordinate('pickupLatitude'), IsLatitude());
const Longitude = () => applyDecorators(TrimOrNull(), IsOptional(), IsString(), Coordinate('pickupLongitude'), IsLongitude());
const Tier = () => IsIn(RATE_TIERS);

export class CreateClientDto {
  @Code(32) clientCode!: string;
  @RequiredText(191) businessName!: string;
  @OptionalText(128) tradeLicenseNo?: string | null;
  @RequiredText(128) contactPersonName!: string;
  @OptionalText(64) contactTitle?: string | null;
  @Phone() mobile1!: string;
  @OptionalPhone() mobile2?: string | null;
  @Email() email!: string;
  @RequiredText(2000) billingAddress!: string;
  @RequiredText(2000) defaultPickupAddress!: string;
  @Latitude() pickupLatitude?: string | null;
  @Longitude() pickupLongitude?: string | null;
  // Only with clients.view_financials (checked by the service). Left out, a new client is on 'standard'.
  @IsOptional() @Tier() rateProfileTier?: RateTier;
  @OptionalText(2000) operationalNotes?: string | null;
}

// Every field may be left out and keeps its value. The balances and status are never set here.
export class UpdateClientDto {
  @IsOmittable() @Code(32) clientCode?: string;
  @IsOmittable() @RequiredText(191) businessName?: string;
  @OptionalText(128) tradeLicenseNo?: string | null;
  @IsOmittable() @RequiredText(128) contactPersonName?: string;
  @OptionalText(64) contactTitle?: string | null;
  @IsOmittable() @Phone() mobile1?: string;
  @OptionalPhone() mobile2?: string | null;
  @IsOmittable() @Email() email?: string;
  @IsOmittable() @RequiredText(2000) billingAddress?: string;
  @IsOmittable() @RequiredText(2000) defaultPickupAddress?: string;
  @Latitude() pickupLatitude?: string | null;
  @Longitude() pickupLongitude?: string | null;
  @IsOmittable() @Tier() rateProfileTier?: RateTier;
  @OptionalText(2000) operationalNotes?: string | null;
}

export class ListClientsQueryDto {
  @Trim() @IsOptional() @IsString() @MaxLength(100)
  search?: string;

  @IsOptional() @IsIn(CLIENT_STATUSES)
  status: (typeof CLIENT_STATUSES)[number] = 'active';

  @IsOptional() @IsIn(CLIENT_SORTS)
  sort: (typeof CLIENT_SORTS)[number] = 'businessName';

  @IsOptional() @IsIn(['asc', 'desc'])
  direction: 'asc' | 'desc' = 'asc';

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page = 1;

  @IsOptional() @Type(() => Number) @IsIn(PAGE_SIZES)
  pageSize = 10;
}

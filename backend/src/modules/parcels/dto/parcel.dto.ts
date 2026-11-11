import { applyDecorators } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min, ValidateIf } from 'class-validator';
import { Trim, TrimOrNull } from '../../../common/decorators/trim.decorator';
import { ID_PATTERN } from '../../../common/ids';
import { PAGE_SIZES } from '../../../common/paging';
import { FAILURE_REASONS, PARCEL_FILTERS, PARCEL_SORTS, type ParcelFilter, STATUS_MOVE_TARGETS, type StatusMove } from '../constants';

// The same rules as the new parcel form and the `parcels` columns.
const PHONE_PATTERN = /^\+?[0-9 ()-]{6,32}$/;
// DECIMAL(12, 2) for money, DECIMAL(8, 2) for the weight: sent as strings, never as JS numbers.
const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;
// More than zero: a parcel always weighs something.
const WEIGHT_PATTERN = /^(?=.*[1-9])\d{1,6}(\.\d{1,2})?$/;
const NOTES_MAX_LENGTH = 2000;

const RequiredText = (max: number) => applyDecorators(Trim(), IsString(), IsNotEmpty(), MaxLength(max));
const OptionalText = (max: number) => applyDecorators(TrimOrNull(), IsOptional(), IsString(), MaxLength(max));
const Phone = () => applyDecorators(Trim(), IsString(), Matches(PHONE_PATTERN, { message: '$property must be a phone number' }));
const Amount = () => applyDecorators(Trim(), IsString(), Matches(MONEY_PATTERN, { message: '$property must be an amount with at most 2 decimals' }));
const Id = () => applyDecorators(IsString(), Matches(ID_PATTERN, { message: '$property must be an id' }));

export class CreateParcelDto {
  // A merchant (client) of the open company.
  @Id() clientId!: string;
  @RequiredText(128) recipientName!: string;
  @Phone() recipientPhone!: string;
  @TrimOrNull() @IsOptional() @IsString() @Matches(PHONE_PATTERN, { message: 'recipientSecondaryPhone must be a phone number' })
  recipientSecondaryPhone?: string | null;
  @RequiredText(2000) deliveryAddress!: string;
  @RequiredText(64) deliveryCityZone!: string;
  @OptionalText(128) deliveryLandmark?: string | null;
  @Trim() @IsString() @Matches(WEIGHT_PATTERN, { message: 'weightKg must be a weight above 0 with at most 2 decimals' })
  weightKg!: string;
  @IsOptional() @IsBoolean() isFragile?: boolean;
  @Amount() deliveryFee!: string;
  @Amount() codAmount!: string;
  // On the pickup_scheduled step of the history.
  @OptionalText(NOTES_MAX_LENGTH) notes?: string | null;
}

// One step forward. Moving into the hub names where the parcel is; a failed attempt names why; a return to sender
// says why in the notes.
export class StatusMoveDto {
  @IsIn(STATUS_MOVE_TARGETS) status!: StatusMove;

  @ValidateIf((body: StatusMoveDto) => body.status === 'in_hub_sorted')
  @RequiredText(128)
  hubLocation?: string;

  @ValidateIf((body: StatusMoveDto) => body.status === 'failed_attempt')
  @IsIn(FAILURE_REASONS)
  reasonCode?: (typeof FAILURE_REASONS)[number];

  // Required for a return to sender; optional (and "" means none) for the others.
  @TrimOrNull()
  @ValidateIf((body: StatusMoveDto) => body.status === 'returned_to_sender' || (body.notes !== undefined && body.notes !== null))
  @IsString() @MaxLength(NOTES_MAX_LENGTH)
  notes?: string | null;
}

export class AssignParcelDto {
  @Id() driverId!: string;
  @OptionalText(NOTES_MAX_LENGTH) notes?: string | null;
}

export class ListParcelsQueryDto {
  @Trim() @IsOptional() @IsString() @MaxLength(100)
  search?: string;

  @IsOptional() @IsIn(PARCEL_FILTERS)
  queue: ParcelFilter = 'all';

  @IsOptional() @IsIn(PARCEL_SORTS)
  sort: (typeof PARCEL_SORTS)[number] = 'createdAt';

  @IsOptional() @IsIn(['asc', 'desc'])
  direction: 'asc' | 'desc' = 'desc';

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page = 1;

  @IsOptional() @Type(() => Number) @IsIn(PAGE_SIZES)
  pageSize = 10;
}

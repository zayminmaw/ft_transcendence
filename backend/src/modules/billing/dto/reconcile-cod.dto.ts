import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsString, Matches } from 'class-validator';
import { Trim } from '../../../common/decorators/trim.decorator';
import { ID_PATTERN } from '../../../common/ids';

export const MAX_PARCELS_PER_HANDOVER = 200;

// What the cashier sends. The reference is the key that makes a repeated request safe; the cash is an amount with
// exactly two decimals, like the DECIMAL(12,2) columns.
export class ReconcileCodDto {
  @Matches(ID_PATTERN, { message: 'driverId must be an id' }) driverId!: string;

  @Trim() @IsString() @Matches(/^[A-Za-z0-9._-]{4,40}$/, { message: 'settlementReference must be 4-40 letters, numbers, dots, dashes or underscores' })
  settlementReference!: string;

  @Trim() @IsString() @Matches(/^\d{1,10}\.\d{2}$/, { message: 'totalCashDropped must be an amount with two decimals' })
  totalCashDropped!: string;

  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(MAX_PARCELS_PER_HANDOVER) @ArrayUnique()
  @Matches(ID_PATTERN, { each: true, message: 'every parcel id must be an id' })
  parcelIds!: string[];
}

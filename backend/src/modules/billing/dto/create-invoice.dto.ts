import { IsISO8601, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Trim } from '../../../common/decorators/trim.decorator';
import { ID_PATTERN } from '../../../common/ids';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

// What finance sends: the merchant and the days to bill. Days are 'YYYY-MM-DD' and must be real calendar days, and the
// last day is included.
export class CreateInvoiceDto {
  @Matches(ID_PATTERN, { message: 'clientId must be an id' }) clientId!: string;

  @Matches(DAY, { message: 'periodStart must be a day like 2026-10-01' }) @IsISO8601({ strict: true }) periodStart!: string;

  @Matches(DAY, { message: 'periodEnd must be a day like 2026-10-31' }) @IsISO8601({ strict: true }) periodEnd!: string;

  @IsOptional() @Trim() @IsString() @MaxLength(1000) notes?: string;
}

import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, Matches, Min } from 'class-validator';
import { ID_PATTERN } from '../../../common/ids';
import { PAGE_SIZES } from '../../../common/paging';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class InvoiceQueryDto {
  @Matches(ID_PATTERN, { message: 'clientId must be an id' }) clientId!: string;

  @IsOptional() @Matches(DAY) @IsISO8601({ strict: true }) periodStart?: string;
  @IsOptional() @Matches(DAY) @IsISO8601({ strict: true }) periodEnd?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsIn(PAGE_SIZES) pageSize = 10;
}

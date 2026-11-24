import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { PAGE_SIZES } from '../../../common/paging';

// Which page of a merchant's ledger to read, newest lines first.
export class LedgerHistoryQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page = 1;

  @IsOptional() @Type(() => Number) @IsIn(PAGE_SIZES)
  pageSize = 25;
}

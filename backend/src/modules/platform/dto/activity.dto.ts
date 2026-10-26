import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { ACTIVITY_FILTERS, ACTIVITY_SORTS } from '../constants';
import { ID_PATTERN, PAGE_SIZES } from './tenant.dto';

const trim = () => Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));

export class ListActivityQueryDto {
  @trim() @IsOptional() @IsString() @MaxLength(100)
  search?: string;

  @IsOptional() @IsIn(ACTIVITY_FILTERS)
  action: (typeof ACTIVITY_FILTERS)[number] = 'all';

  // One tenant's history.
  @IsOptional() @IsString() @Matches(ID_PATTERN, { message: 'tenantId must be a positive integer' })
  tenantId?: string;

  @IsOptional() @IsIn(ACTIVITY_SORTS)
  sort: (typeof ACTIVITY_SORTS)[number] = 'createdAt';

  @IsOptional() @IsIn(['asc', 'desc'])
  direction: 'asc' | 'desc' = 'desc';

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page = 1;

  @IsOptional() @Type(() => Number) @IsIn(PAGE_SIZES)
  pageSize = 10;
}

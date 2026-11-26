import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { ID_PATTERN } from '../../../common/ids';
import { PAGE_SIZES } from '../../../common/paging';
import { INVOICE_STATUSES, type InvoiceStatus } from '../entities/invoice.entity';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

const trimOptional = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || undefined : value);

export class InvoiceExportQueryDto {
  @IsOptional() @Matches(ID_PATTERN, { message: 'clientId must be an id' }) clientId?: string;

  @IsOptional() @Matches(DAY) @IsISO8601({ strict: true }) periodStart?: string;
  @IsOptional() @Matches(DAY) @IsISO8601({ strict: true }) periodEnd?: string;

  @IsOptional() @IsIn(INVOICE_STATUSES) status?: InvoiceStatus;
  @IsOptional() @Transform(trimOptional) @IsString() @MaxLength(120) search?: string;
}

export class InvoiceQueryDto extends InvoiceExportQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsIn(PAGE_SIZES) pageSize = 10;
}

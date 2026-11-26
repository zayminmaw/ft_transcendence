import { IsIn, IsOptional } from 'class-validator';
import {
  EXPORT_FORMATS,
  EXPORT_SECTIONS,
  type ExportFormat,
  type ExportSection,
} from '../company-export.types';

export class CompanyExportQueryDto {
  @IsOptional()
  @IsIn(EXPORT_FORMATS)
  format: ExportFormat = 'json';

  @IsOptional()
  @IsIn(EXPORT_SECTIONS)
  section: ExportSection = 'all';
}

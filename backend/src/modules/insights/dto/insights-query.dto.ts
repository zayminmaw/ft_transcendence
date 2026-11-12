import { Type } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';
import type { InsightsRange } from '../types/insights';

export const INSIGHTS_RANGES: readonly InsightsRange[] = [7, 30, 90];

// How many UTC days back from today, today included. A query string arrives as text, so it is turned into a number
// first; anything that is not exactly 7, 30 or 90 is a 400.
export class InsightsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsIn(INSIGHTS_RANGES)
  range: InsightsRange = 30;
}

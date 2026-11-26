import { Type } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';
import { SIGNINS_DEFAULT_RANGE, SIGNINS_RANGES } from '../constants';
import type { SigninsRange } from '../types/signins';

// How many UTC days back from today, today included. A query string arrives as text, so it is turned into a number
// first; anything that is not exactly 7, 30 or 90 is a 400.
export class SigninsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsIn(SIGNINS_RANGES)
  range: SigninsRange = SIGNINS_DEFAULT_RANGE;
}

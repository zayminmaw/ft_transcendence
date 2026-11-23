import { applyDecorators } from '@nestjs/common';
import { IsISO8601, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Trim, TrimOrNull, TrimUpper } from './trim.decorator';

// The field rules the module DTOs share, the same as the frontend's utils/form-rules. A rule for a required field
// doesn't make it omittable: an update DTO adds IsOmittable.

// DECIMAL(12, 2): amounts are sent as strings, never as JS numbers.
export const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;
const PHONE_PATTERN = /^\+?[0-9 ()-]{6,32}$/;

export const RequiredText = (max: number) => applyDecorators(Trim(), IsString(), IsNotEmpty(), MaxLength(max));

export const OptionalText = (max: number) => applyDecorators(TrimOrNull(), IsOptional(), IsString(), MaxLength(max));

// A record's own code, e.g. CL-0007: letters, digits and dashes, saved in capitals.
export const Code = (max: number) => applyDecorators(
  TrimUpper(), IsString(), Matches(new RegExp(`^[A-Z0-9-]{2,${max}}$`), { message: `$property must be 2-${max} capital letters, numbers or dashes` }),
);

const phoneNumber = () => Matches(PHONE_PATTERN, { message: '$property must be a phone number' });
export const Phone = () => applyDecorators(Trim(), IsString(), phoneNumber());
export const OptionalPhone = () => applyDecorators(TrimOrNull(), IsOptional(), IsString(), phoneNumber());

// 'YYYY-MM-DD', like the DATE columns, and a real day (no 2026-02-30).
export const Day = () => applyDecorators(
  IsString(), Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '$property must be a YYYY-MM-DD date' }), IsISO8601({ strict: true }),
);
export const OptionalDay = () => applyDecorators(TrimOrNull(), IsOptional(), Day());

// An amount with at most 2 decimals; money by default, or a smaller DECIMAL column's own pattern.
export const Amount = (pattern = MONEY_PATTERN) => applyDecorators(
  Trim(), IsString(), Matches(pattern, { message: '$property must be an amount with at most 2 decimals' }),
);

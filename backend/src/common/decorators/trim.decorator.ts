import { Transform } from 'class-transformer';
import { ValidateIf } from 'class-validator';

// Trims a string field before it is validated. Anything else is left for the validators to refuse.
export const Trim = () => Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));

// An optional detail sent as "" is cleared, like one sent as null.
export const TrimOrNull = () => Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || null : value));

// Codes kept in capitals, so "cl-0001" and "CL-0001" are the same code.
export const TrimUpper = () => Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value));

// For a PATCH: left out means unchanged; null is refused, because the column is required.
export const IsOmittable = () => ValidateIf((_object: object, value: unknown) => value !== undefined);

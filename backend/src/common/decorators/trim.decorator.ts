import { Transform } from 'class-transformer';

// Trims a string field before it is validated. Anything else is left for the validators to refuse.
export const Trim = () => Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));

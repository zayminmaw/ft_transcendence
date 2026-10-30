import type { ParseKeys } from 'i18next';
import { z } from 'zod';

// The field rules both asset forms share. Messages are translation keys, translated when shown.
export const key = (value: ParseKeys<'assets'>) => value;
export const required = (max: number) =>
	z.string().trim().min(1, key('errors.required')).max(max, key('errors.tooLong'));
export const optional = (max: number) => z.string().trim().max(max, key('errors.tooLong'));
// <input type="date"> gives 'YYYY-MM-DD', the same as the DATE columns.
export const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, key('errors.invalidDate'));
export const optionalDate = z.union([z.literal(''), date]);
// DECIMAL(12, 2), kept as a string, never a JS number.
export const money = z
	.string()
	.trim()
	.regex(/^\d{1,10}(\.\d{1,2})?$/, key('errors.invalidAmount'));

import type { ParseKeys } from 'i18next';
import { z } from 'zod';

// The field rules the company forms share, the same as the API's checks. Their messages are translation keys that
// every namespace using a rule defines under `errors`, so each form can word them its own way (e.g. its own example).
type FormNamespace = 'clients' | 'drivers' | 'assets';
const key = (value: ParseKeys<FormNamespace>) => value;

// The API's general email check (users/account-rules EMAIL_PATTERN), for contact addresses.
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// A login account's email (users/accounts): plain printable ASCII, so look-alike letters can't pass for another.
export const ACCOUNT_EMAIL_PATTERN =
	/^[\x21-\x3F\x41-\x7E]+@[\x21-\x3F\x41-\x7E]+\.[\x21-\x3F\x41-\x7E]+$/;
export const EMAIL_MAX_LENGTH = 191;

export const required = (max: number) =>
	z.string().trim().min(1, key('errors.required')).max(max, key('errors.tooLong'));

export const optional = (max: number) => z.string().trim().max(max, key('errors.tooLong'));

// A record's own code, e.g. CL-0007: letters, digits and dashes, saved in capitals.
export const code = (max: number, message = key('errors.invalidCode')) =>
	z
		.string()
		.trim()
		.toUpperCase()
		.regex(new RegExp(`^[A-Z0-9-]{2,${max}}$`), message);

export const phone = z
	.string()
	.trim()
	.regex(/^\+?[0-9 ()-]{6,32}$/, key('errors.invalidPhone'));

export const email = z
	.string()
	.trim()
	.max(EMAIL_MAX_LENGTH, key('errors.tooLong'))
	.regex(EMAIL_PATTERN, key('errors.invalidEmail'));

// <input type="date"> gives 'YYYY-MM-DD', the same as the DATE columns.
export const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, key('errors.invalidDate'));
export const optionalDate = z.union([z.literal(''), date]);

// DECIMAL(12, 2), kept as a string, never a JS number.
export const money = z
	.string()
	.trim()
	.regex(/^\d{1,10}(\.\d{1,2})?$/, key('errors.invalidAmount'));

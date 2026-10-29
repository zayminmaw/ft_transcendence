import { maskEmail, maskPhone, REDACTED, redact } from '../../common/logging/redaction';
import type { FieldRule, FieldRules } from './audit-resources';

export interface AuditValues {
	oldValues: Record<string, unknown> | null;
	newValues: Record<string, unknown> | null;
}

const MAX_TEXT = 500;

// Comparable, storable form: dates as ISO strings, undefined as null, long text cut.
function normalize(value: unknown): unknown {
	if (value === undefined) return null;
	if (value instanceof Date) return value.toISOString();
	if (typeof value === 'string') return value.length > MAX_TEXT ? `${value.slice(0, MAX_TEXT)}…` : value;
	if (typeof value === 'bigint') return value.toString();
	return value;
}

function same(a: unknown, b: unknown): boolean {
	return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}

// Stored as it is (the company may see all of its own data), except keys that look like secrets.
function store(rule: FieldRule | FieldRules, value: unknown): unknown {
	if (value === null || value === undefined) return null;
	if (typeof rule === 'object') {
		return typeof value === 'object' ? pick(rule, value as Record<string, unknown>) : REDACTED;
	}
	return redact(normalize(value));
}

// Only the allowlisted fields.
function pick(rules: FieldRules, source: Record<string, unknown>): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const [field, rule] of Object.entries(rules)) {
		if (field in source) result[field] = store(rule, source[field]);
	}
	return result;
}

function mask(rule: FieldRule | FieldRules | undefined, value: unknown): unknown {
	if (value === null || value === undefined || value === REDACTED) return value ?? null;
	if (rule === undefined) return REDACTED;
	if (typeof rule === 'object') {
		return typeof value === 'object' ? maskForPlatform(rule, value as Record<string, unknown>) : REDACTED;
	}
	switch (rule) {
		case 'plain': return value;
		case 'maskEmail': return typeof value === 'string' ? maskEmail(value) : REDACTED;
		case 'maskPhone': return typeof value === 'string' ? maskPhone(value) : REDACTED;
		case 'redact': return REDACTED;
	}
}

// Stored values as people outside the company (platform administrators) may see them: personal data masked.
export function maskForPlatform(rules: FieldRules, values: Record<string, unknown>): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const [field, value] of Object.entries(values)) result[field] = mask(rules[field], value);
	return result;
}

// The allowlisted fields of each snapshot. With `onlyChanges` (updates) just the fields that changed. Other actions
// keep their context: an assignment keeps whom it was about even though that did not change.
export function auditValues(
	rules: FieldRules, before?: object | null, after?: object | null, onlyChanges = false,
): AuditValues {
	const old = before as Record<string, unknown> | null | undefined;
	const next = after as Record<string, unknown> | null | undefined;
	if (!onlyChanges || !old || !next) {
		return { oldValues: old ? emptyToNull(pick(rules, old)) : null, newValues: next ? emptyToNull(pick(rules, next)) : null };
	}
	const oldValues: Record<string, unknown> = {};
	const newValues: Record<string, unknown> = {};
	for (const [field, rule] of Object.entries(rules)) {
		if (!(field in old) && !(field in next)) continue;
		if (same(old[field], next[field])) continue;
		oldValues[field] = store(rule, old[field]);
		newValues[field] = store(rule, next[field]);
	}
	return { oldValues: emptyToNull(oldValues), newValues: emptyToNull(newValues) };
}

// Description words: short scalars only, never a denied key.
export function auditParams(params: Record<string, unknown> | undefined): Record<string, unknown> | null {
	if (!params) return null;
	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(redact(params) as Record<string, unknown>)) {
		if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
			result[key] = typeof value === 'string' ? value.slice(0, 128) : value;
		}
	}
	return emptyToNull(result);
}

function emptyToNull(values: Record<string, unknown>): Record<string, unknown> | null {
	return Object.keys(values).length > 0 ? values : null;
}

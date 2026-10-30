import type { TFunction } from 'i18next';
import { formatDate, formatNumber } from '@utils/format';
import type { AuditChange, AuditEntry } from '../api';

const REDACTED = '[REDACTED]';
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

function humanize(key: string): string {
	return key
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		.replace(/_/g, ' ')
		.toLowerCase();
}

// A translated name, or the key made readable when no translation exists yet.
export function lookup(
	t: TFunction<'audit'>,
	group: 'resources' | 'fields' | 'roles' | 'modules',
	key: string,
): string {
	const names = t(group, { returnObjects: true }) as Record<string, string>;
	return names[key] ?? humanize(key);
}

// Who did it: the name at the time, else the account id (rows written before names were kept), else the system.
export function actorText(t: TFunction<'audit'>, entry: AuditEntry): string {
	return entry.actor.name ?? (entry.actor.id ? `#${entry.actor.id}` : t('system'));
}

export function resourceName(t: TFunction<'audit'>, type: string | null): string {
	return type ? lookup(t, 'resources', type) : '';
}

export function fieldLabel(t: TFunction<'audit'>, field: string): string {
	return lookup(t, 'fields', field);
}

// "Changed status of invoice INV-2026-0017": built from the action, the resource and the entry's params, so it
// reads naturally in every language.
// What people call the record: its label, else its id, else nothing (e.g. a read of the whole trail).
export function resourceText(entry: AuditEntry): string {
	return entry.resource.label ?? (entry.resource.id ? `#${entry.resource.id}` : '');
}

export function describeEntry(t: TFunction<'audit'>, entry: AuditEntry): string {
	const label = resourceText(entry);
	const sentence = t(`actions.${entry.action}`, {
		...entry.params,
		resource: resourceName(t, entry.resource.type),
		label,
	});
	return sentence.replace(/\s+/g, ' ').trim();
}

export function displayValue(
	t: TFunction<'audit'>,
	value: unknown,
	language: string,
	field?: string,
): string {
	if (value === null || value === undefined || value === '') return t('values.empty');
	if (value === REDACTED) return t('values.hidden');
	if (field === 'role' && typeof value === 'string') return lookup(t, 'roles', value);
	if (typeof value === 'boolean') return value ? t('values.yes') : t('values.no');
	if (typeof value === 'number') return formatNumber(value, language);
	if (typeof value === 'string' && ISO_TIME.test(value)) {
		return formatDate(value, language, { dateStyle: 'medium', timeStyle: 'short' });
	}
	if (Array.isArray(value))
		return value.map((item) => displayValue(t, item, language)).join(', ');
	if (typeof value === 'object') {
		const record = value as Record<string, unknown>;
		const name = record.username ?? record.name ?? record.title;
		if (typeof name === 'string') return name;
		return Object.entries(record)
			.map(([key, item]) => `${fieldLabel(t, key)}: ${displayValue(t, item, language)}`)
			.join(', ');
	}
	return String(value);
}

export type ChangeRow = { field: string; change: AuditChange; changed: boolean };

// Changed fields first; unchanged context (e.g. whom an assignment was about) after.
export function changeRows(entry: AuditEntry): ChangeRow[] {
	return Object.entries(entry.changes ?? {})
		.map(([field, change]) => ({
			field,
			change,
			changed: JSON.stringify(change.before) !== JSON.stringify(change.after),
		}))
		.sort((a, b) => Number(b.changed) - Number(a.changed));
}

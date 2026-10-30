// Every language shows Latin digits (1,234) and the Gregorian year (2026), whatever the locale's default.
// Use formatNumber for counts (pages, rows, parcels). Money amounts are strings and get their own
// formatter with the billing work, so they never pass through a JS number.

// A count that hasn't loaded yet (null or undefined) shows as a dash.
export function formatNumber(
	value: number | null | undefined,
	language: string,
	options?: Intl.NumberFormatOptions,
): string {
	if (value == null) return '—';
	return new Intl.NumberFormat(language, { ...options, numberingSystem: 'latn' }).format(value);
}

// A 'YYYY-MM-DD' DATE column is a calendar day: read it as local midnight, not UTC midnight, so it never shows as
// the day before in time zones behind UTC.
export function parseDay(value: string): Date {
	const [year, month, day] = value.split('-').map(Number);
	return new Date(year, month - 1, day);
}

// Takes a Date, an API date-time string or a 'YYYY-MM-DD' day. Without options it shows a medium date, e.g.
// "Oct 22, 2026".
export function formatDate(
	value: Date | string,
	language: string,
	options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
): string {
	const date =
		typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
			? parseDay(value)
			: new Date(value);
	return new Intl.DateTimeFormat(language, {
		...options,
		calendar: 'gregory',
		numberingSystem: 'latn',
	}).format(date);
}

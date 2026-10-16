// Every language shows Latin digits (1,234) and the Gregorian year (2026), whatever the locale's default.
// Use formatNumber for counts (pages, rows, parcels). Money amounts are strings and get their own
// formatter with the billing work, so they never pass through a JS number.

export function formatNumber(
	value: number,
	language: string,
	options?: Intl.NumberFormatOptions,
): string {
	return new Intl.NumberFormat(language, { ...options, numberingSystem: 'latn' }).format(value);
}

export function formatDate(
	value: Date,
	language: string,
	options?: Intl.DateTimeFormatOptions,
): string {
	return new Intl.DateTimeFormat(language, {
		...options,
		calendar: 'gregory',
		numberingSystem: 'latn',
	}).format(value);
}

// Money travels as strings with two decimals, like the DECIMAL(12,2) columns. Adding goes through whole cents, so no
// floating point error can creep into a total. Amounts here are never negative.
const toCents = (value: string): number => {
	const [whole, fraction = ''] = value.split('.');
	return Number(whole) * 100 + Number(fraction.padEnd(2, '0').slice(0, 2));
};

export function addAmounts(first: string, second: string): string {
	const total = toCents(first) + toCents(second);
	return `${Math.floor(total / 100)}.${String(total % 100).padStart(2, '0')}`;
}

// Money columns are DECIMAL(12,2) and travel as strings like '12.50'. Every sum goes through whole cents (BigInt), so
// no floating point is involved. The column holds ten digits before the point.
const MONEY = /^(-?)(\d{1,10})\.(\d{2})$/;
const MAX_CENTS = 999_999_999_999n;

// '12.50' becomes 1250n. Anything but digits with exactly two decimals is refused, so a stray '12.5' or '1e3' never
// reaches a balance.
export function toCents(value: string): bigint {
  const match = MONEY.exec(value);
  if (!match) throw new Error(`"${value}" is not an amount with two decimals.`);
  const cents = BigInt(match[2]) * 100n + BigInt(match[3]);
  return match[1] === '-' ? -cents : cents;
}

// 1250n becomes '12.50'. A result the column could not hold is refused rather than stored wrong.
export function fromCents(cents: bigint): string {
  if (cents > MAX_CENTS || cents < -MAX_CENTS) throw new Error('That amount is more than a balance can hold.');
  const size = cents < 0n ? -cents : cents;
  return `${cents < 0n ? '-' : ''}${size / 100n}.${String(size % 100n).padStart(2, '0')}`;
}

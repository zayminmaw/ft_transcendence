// RFC-4180 CSV encoder with spreadsheet formula-injection neutralization.
// Any value starting with '=', '+', '-', '@', '\t', or '\r' is prefixed with a single quote so spreadsheet software
// treats it as literal text rather than an executable formula.
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export type CsvCell = string | number | null | undefined;

export function formatCsvCell(value: CsvCell): string {
  const raw = value == null ? '' : String(value);
  const safe = FORMULA_PREFIX.test(raw) ? `'${raw}` : raw;
  if (/[",\r\n]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}

export function buildCsv(headers: readonly string[], rows: readonly (readonly CsvCell[])[]): string {
  const lines = [headers.map(formatCsvCell).join(',')];
  for (const row of rows) lines.push(row.map(formatCsvCell).join(','));
  return `${lines.join('\r\n')}\r\n`;
}

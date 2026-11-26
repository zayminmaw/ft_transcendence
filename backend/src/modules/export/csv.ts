// RFC-4180 CSV serialization with spreadsheet formula-injection neutralization.
// Cells starting with =, +, -, @, \t, or \r are prefixed with a single quote so spreadsheet applications treat them
// as plain text instead of executable formulas.

const FORMULA_TRIGGER = /^[=+\-@\t\r]/;
const NEEDS_QUOTING = /[",\r\n]/;

export type CsvCell = string | number | boolean | null | undefined;

export function neutralizeFormula(value: string): string {
  return FORMULA_TRIGGER.test(value) ? `'${value}` : value;
}

export function formatCsvCell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  const text = neutralizeFormula(String(value));
  if (!NEEDS_QUOTING.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function formatCsvRow(values: readonly CsvCell[]): string {
  return values.map(formatCsvCell).join(',');
}

export function serializeCsvTable<T extends object>(
  columns: readonly (keyof T & string)[],
  rows: readonly T[],
): string {
  const lines = [formatCsvRow(columns)];
  for (const row of rows) {
    lines.push(formatCsvRow(columns.map((column) => row[column] as CsvCell)));
  }
  return `${lines.join('\r\n')}\r\n`;
}

export interface CsvSectionBlock<T extends object = Record<string, CsvCell>> {
  name: string;
  columns: readonly (keyof T & string)[];
  rows: readonly T[];
}

// Bundles multiple datasets into one RFC-4180 CSV file, separated by a blank line and a two-cell section marker row.
export function serializeCsvSections(sections: readonly CsvSectionBlock[]): string {
  const blocks = sections.map(({ name, columns, rows }) => {
    const lines = [formatCsvRow(['section', name]), formatCsvRow(columns)];
    for (const row of rows) {
      lines.push(formatCsvRow(columns.map((column) => row[column] as CsvCell)));
    }
    return lines.join('\r\n');
  });
  return `${blocks.join('\r\n\r\n')}\r\n`;
}

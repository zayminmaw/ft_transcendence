// A unique key refused the row (MariaDB/MySQL errno 1062). TypeORM wraps the driver's error in driverError; a raw
// driver error carries the fields itself.
export function isDuplicateKey(error: unknown): boolean {
  const failure = error as { errno?: number; code?: string; driverError?: { errno?: number; code?: string } } | null;
  const driver = failure?.driverError ?? failure;
  return driver?.errno === 1062 || driver?.code === 'ER_DUP_ENTRY';
}

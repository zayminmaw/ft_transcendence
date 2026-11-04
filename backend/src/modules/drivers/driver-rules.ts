import type { DriverChanges, DriverRecord, DriverValues } from './types/driver';

export type RuleRefusal = 'termination_date_required' | 'terminated';

// A terminated driver needs the date employment ended.
export function missingTerminationDate(values: Pick<DriverValues, 'employmentStatus' | 'terminationDate'>): boolean {
  return values.employmentStatus === 'terminated' && !values.terminationDate;
}

// What an edit really changes, after the employment rules: fields equal to the saved values are dropped, and a
// terminated driver needs a termination date and is always off duty. Pure, so the repository applies it under its
// row lock and the HTTP tests' fake repository applies the very same rules.
export function planUpdate(before: DriverRecord, changes: DriverChanges): { changed: DriverChanges } | { refusal: RuleRefusal } {
  const changed: DriverChanges = Object.fromEntries(
    Object.entries(changes).filter(([field, value]) => value !== undefined && before[field as keyof DriverRecord] !== value),
  );
  const next = { ...before, ...changed };
  if (next.employmentStatus === 'terminated') {
    if (missingTerminationDate(next)) return { refusal: 'termination_date_required' };
    if (changed.dispatchStatus && changed.dispatchStatus !== 'off_duty') return { refusal: 'terminated' };
    if (before.dispatchStatus !== 'off_duty') changed.dispatchStatus = 'off_duty';
  }
  return { changed };
}

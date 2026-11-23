import type { AssetChanges, AssetRecord } from './types/asset';

export type RuleRefusal = 'checked_out' | 'already_checked_out' | 'not_checked_out' | 'decommissioned';

// Pure, so the repository applies them under its row lock and the HTTP tests' fake repository applies the very same
// rules.

// What an edit really changes: fields equal to the saved values are dropped. An asset a driver has can't be
// decommissioned until it's checked in.
export function planUpdate(before: AssetRecord, changes: AssetChanges): { changed: AssetChanges } | { refusal: RuleRefusal } {
  const changed: AssetChanges = Object.fromEntries(
    Object.entries(changes).filter(([field, value]) => value !== undefined && before[field as keyof AssetRecord] !== value),
  );
  if (changed.currentCondition === 'decommissioned' && before.holder) return { refusal: 'checked_out' };
  return { changed };
}

// One driver at a time, and a decommissioned asset doesn't go out.
export function checkOutRefusal(asset: AssetRecord): RuleRefusal | null {
  if (asset.currentCondition === 'decommissioned') return 'decommissioned';
  return asset.holder ? 'already_checked_out' : null;
}

export function checkInRefusal(asset: AssetRecord): RuleRefusal | null {
  return asset.holder ? null : 'not_checked_out';
}

// A decommissioned asset isn't serviced; editing its condition brings it back first.
export function maintenanceRefusal(asset: AssetRecord): RuleRefusal | null {
  return asset.currentCondition === 'decommissioned' ? 'decommissioned' : null;
}

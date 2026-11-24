import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { LedgerService } from './ledger.service';
import { fromCents, toCents } from './money';

export interface PendingCodChange {
  organizationId: string;
  clientId: string;
  // The cash recorded as collected, as the DECIMAL column answers it. '0.00' means no cash is involved.
  codAmount: string;
  userId: string;
}

// The cash a merchant's drivers have collected and not yet handed to the cashier. It goes up when a delivery records the
// cash and comes down when the cashier verifies it (COD handover). The change runs on the caller's manager, so it
// commits or rolls back with the parcel's own move.
@Injectable()
export class PendingCodService {
  constructor(private readonly ledger: LedgerService) {}

  hold(manager: EntityManager, change: PendingCodChange): Promise<void> {
    return this.move(manager, change, toCents(change.codAmount));
  }

  private async move(manager: EntityManager, change: PendingCodChange, cents: bigint): Promise<void> {
    if (cents === 0n) return;
    const result = await this.ledger.post(manager, {
      organizationId: change.organizationId, clientId: change.clientId, lines: [], pendingChange: fromCents(cents), createdByUserId: change.userId,
    });
    // Not expected, a parcel always has its merchant. Throwing rolls the parcel's move back, so the books and the parcel
    // never disagree.
    if (result.status !== 'posted') throw new Error(`The COD of this parcel could not be tracked (${result.status}), so its move was rolled back.`);
  }
}

import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { fromCents, toCents } from './money';
import { LedgerRepository } from './ledger.repository';
import type { LedgerPost, LedgerResult } from './types/ledger';

const ID = /^[1-9]\d*$/;
const DESCRIPTION_LENGTH = 255;

// The one place a merchant's balance changes. A caller opens the transaction, calls `post`, and saves its own audit
// row on the same manager. Bad input throws, which rolls the caller's transaction back; nothing is half written.
// A balance may go below zero: the merchant then owes the courier.
@Injectable()
export class LedgerService {
  constructor(private readonly ledger: LedgerRepository) {}

  async post(manager: EntityManager, post: LedgerPost): Promise<LedgerResult> {
    this.check(post);
    const client = await this.ledger.lockClient(manager, post.organizationId, post.clientId);
    if (!client) return { status: 'client_not_found' };

    // Read after the lock, so this is the balance no one else can change until the transaction ends.
    let balance = toCents(client.currentBalance);
    const rows = post.lines.map((line) => {
      balance += line.direction === 'credit' ? toCents(line.amount) : -toCents(line.amount);
      return {
        organizationId: post.organizationId,
        clientId: post.clientId,
        referenceType: line.referenceType,
        referenceId: line.referenceId,
        entryType: line.direction,
        amount: line.amount,
        balanceAfter: fromCents(balance),
        description: line.description,
        createdByUserId: post.createdByUserId,
      };
    });
    const pending = fromCents(toCents(client.pendingCodBalance) + toCents(post.pendingChange ?? '0.00'));

    const entries = await this.ledger.insertEntries(manager, rows);
    const currentBalance = fromCents(balance);
    await this.ledger.setBalances(manager, post.clientId, currentBalance, pending);
    return { status: 'posted', entries, currentBalance, pendingCodBalance: pending };
  }

  // Programming mistakes, not user input: the caller's endpoint validates what a person typed.
  private check(post: LedgerPost): void {
    if (!ID.test(post.organizationId) || !ID.test(post.clientId)) throw new Error('A post needs a company id and a merchant id.');
    if (post.lines.length === 0 && (post.pendingChange === undefined || toCents(post.pendingChange) === 0n)) {
      throw new Error('A post needs at least one line or a change to the pending balance.');
    }
    for (const line of post.lines) {
      if (toCents(line.amount) <= 0n) throw new Error('A ledger amount must be above zero; the direction carries the sign.');
      if (line.referenceId !== null && !ID.test(line.referenceId)) throw new Error('A reference id is a positive whole number or null.');
      if (line.description.trim() === '' || line.description.length > DESCRIPTION_LENGTH) {
        throw new Error(`A description is 1 to ${DESCRIPTION_LENGTH} characters.`);
      }
    }
  }
}

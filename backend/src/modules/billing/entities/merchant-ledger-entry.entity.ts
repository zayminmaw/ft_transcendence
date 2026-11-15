import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export const LEDGER_REFERENCE_TYPES = ['cod_credit', 'delivery_fee_debit', 'payout_disbursement', 'manual_adjustment', 'invoice_offset'] as const;
export type LedgerReferenceType = (typeof LEDGER_REFERENCE_TYPES)[number];

// Mirrors `merchant_ledger_entries`: one line of a merchant's running balance. A line is never changed after it is
// written. DECIMAL columns stay strings.
@Entity('merchant_ledger_entries')
export class MerchantLedgerEntry {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'organization_id', type: 'bigint', unsigned: true })
  organizationId!: string;

  @Column({ name: 'client_id', type: 'bigint', unsigned: true })
  clientId!: string;

  @Column({ name: 'reference_type', type: 'enum', enum: LEDGER_REFERENCE_TYPES })
  referenceType!: LedgerReferenceType;

  @Column({ name: 'reference_id', type: 'bigint', unsigned: true, nullable: true })
  referenceId!: string | null;

  @Column({ name: 'entry_type', type: 'enum', enum: ['credit', 'debit'] })
  entryType!: 'credit' | 'debit';

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: string;

  @Column({ name: 'balance_after', type: 'decimal', precision: 12, scale: 2 })
  balanceAfter!: string;

  @Column({ type: 'varchar', length: 255 })
  description!: string;

  @Column({ name: 'created_by_user_id', type: 'bigint', unsigned: true, nullable: true })
  createdByUserId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

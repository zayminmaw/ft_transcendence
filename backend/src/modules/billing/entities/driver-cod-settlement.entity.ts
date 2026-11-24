import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Mirrors `driver_cod_settlements`: one driver's cash handover, checked by a cashier. DECIMAL columns stay strings.
@Entity('driver_cod_settlements')
export class DriverCodSettlement {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'organization_id', type: 'bigint', unsigned: true })
  organizationId!: string;

  // Unique across every company, so it is stored with the company id in front (see CodService).
  @Column({ name: 'settlement_reference', type: 'varchar', length: 64 })
  settlementReference!: string;

  @Column({ name: 'driver_id', type: 'bigint', unsigned: true })
  driverId!: string;

  @Column({ name: 'reconciled_by_user_id', type: 'bigint', unsigned: true })
  reconciledByUserId!: string;

  @Column({ name: 'total_cod_expected', type: 'decimal', precision: 12, scale: 2 })
  totalCodExpected!: string;

  @Column({ name: 'total_cash_dropped', type: 'decimal', precision: 12, scale: 2 })
  totalCashDropped!: string;

  @Column({ name: 'discrepancy_amount', type: 'decimal', precision: 12, scale: 2 })
  discrepancyAmount!: string;

  @Column({ name: 'settlement_status', type: 'enum', enum: ['pending', 'verified', 'discrepancy_flagged'] })
  settlementStatus!: 'pending' | 'verified' | 'discrepancy_flagged';

  @Column({ name: 'reconciliation_notes', type: 'text', nullable: true })
  reconciliationNotes!: string | null;

  @CreateDateColumn({ name: 'settled_at' })
  settledAt!: Date;
}

import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export const INVOICE_STATUSES = ['draft', 'issued', 'paid_via_balance_offset', 'paid_via_bank_transfer', 'overdue'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

// Mirrors `invoices`: one statement of a merchant's delivery fees for a period. DECIMAL columns stay strings, and the
// DATE columns are plain 'YYYY-MM-DD' strings.
@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'organization_id', type: 'bigint', unsigned: true })
  organizationId!: string;

  @Column({ name: 'invoice_number', type: 'varchar', length: 64 })
  invoiceNumber!: string;

  @Column({ name: 'client_id', type: 'bigint', unsigned: true })
  clientId!: string;

  @Column({ name: 'billing_period_start', type: 'date' })
  billingPeriodStart!: string;

  @Column({ name: 'billing_period_end', type: 'date' })
  billingPeriodEnd!: string;

  @Column({ name: 'total_deliveries', type: 'int', unsigned: true })
  totalDeliveries!: number;

  @Column({ name: 'total_delivery_fees', type: 'decimal', precision: 12, scale: 2 })
  totalDeliveryFees!: string;

  @Column({ name: 'total_cod_collected', type: 'decimal', precision: 12, scale: 2 })
  totalCodCollected!: string;

  @Column({ name: 'net_amount_due', type: 'decimal', precision: 12, scale: 2 })
  netAmountDue!: string;

  @Column({ type: 'enum', enum: INVOICE_STATUSES })
  status!: InvoiceStatus;

  @Column({ name: 'issue_date', type: 'date' })
  issueDate!: string;

  @Column({ name: 'due_date', type: 'date' })
  dueDate!: string;

  @Column({ name: 'created_by_user_id', type: 'bigint', unsigned: true })
  createdByUserId!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

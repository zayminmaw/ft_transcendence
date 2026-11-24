import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Mirrors `invoice_items`: one parcel on one invoice. The parcel column is unique, so a parcel can be billed only once.
@Entity('invoice_items')
export class InvoiceItem {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'invoice_id', type: 'bigint', unsigned: true })
  invoiceId!: string;

  @Column({ name: 'parcel_id', type: 'bigint', unsigned: true })
  parcelId!: string;

  @Column({ name: 'delivery_fee', type: 'decimal', precision: 12, scale: 2 })
  deliveryFee!: string;

  @Column({ name: 'cod_amount', type: 'decimal', precision: 12, scale: 2 })
  codAmount!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  surcharges!: string;

  @Column({ name: 'net_item_amount', type: 'decimal', precision: 12, scale: 2 })
  netItemAmount!: string;
}

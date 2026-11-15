import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Mirrors `driver_cod_collections`: the cash taken for one parcel, inside one settlement. A parcel has at most one
// (unique key on parcel_id), so it can never be claimed by two settlement sheets.
@Entity('driver_cod_collections')
export class DriverCodCollection {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'settlement_id', type: 'bigint', unsigned: true })
  settlementId!: string;

  @Column({ name: 'parcel_id', type: 'bigint', unsigned: true })
  parcelId!: string;

  @Column({ name: 'amount_collected', type: 'decimal', precision: 12, scale: 2 })
  amountCollected!: string;

  @Column({ name: 'payment_method', type: 'enum', enum: ['cash', 'pos_card', 'qr_transfer'] })
  paymentMethod!: 'cash' | 'pos_card' | 'qr_transfer';

  @CreateDateColumn({ name: 'collected_at' })
  collectedAt!: Date;
}

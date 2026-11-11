import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { PARCEL_STATUSES, type ParcelStatus } from '../constants';

// Mirrors `parcels`, without the proof-of-delivery columns, which only POD will write. The client, driver and asset
// tables belong to other modules, so the repository joins them in SQL rather than through relations.
@Entity('parcels')
export class Parcel {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'organization_id', type: 'bigint', unsigned: true })
  organizationId!: string;

  // Unique across every company: the public tracking page finds a parcel by it alone.
  @Column({ name: 'tracking_number', type: 'varchar', length: 64, unique: true })
  trackingNumber!: string;

  @Column({ name: 'client_id', type: 'bigint', unsigned: true })
  clientId!: string;

  @Column({ name: 'assigned_driver_id', type: 'bigint', unsigned: true, nullable: true })
  assignedDriverId!: string | null;

  @Column({ name: 'assigned_asset_id', type: 'bigint', unsigned: true, nullable: true })
  assignedAssetId!: string | null;

  @Column({ name: 'dispatch_run_id', type: 'bigint', unsigned: true, nullable: true })
  dispatchRunId!: string | null;

  @Column({ name: 'recipient_name', type: 'varchar', length: 128 })
  recipientName!: string;

  @Column({ name: 'recipient_phone', type: 'varchar', length: 32 })
  recipientPhone!: string;

  @Column({ name: 'recipient_secondary_phone', type: 'varchar', length: 32, nullable: true })
  recipientSecondaryPhone!: string | null;

  @Column({ name: 'delivery_address', type: 'text' })
  deliveryAddress!: string;

  @Column({ name: 'delivery_city_zone', type: 'varchar', length: 64 })
  deliveryCityZone!: string;

  @Column({ name: 'delivery_landmark', type: 'varchar', length: 128, nullable: true })
  deliveryLandmark!: string | null;

  @Column({ name: 'weight_kg', type: 'decimal', precision: 8, scale: 2, default: '0.50' })
  weightKg!: string;

  @Column({ name: 'is_fragile', type: 'boolean', default: false })
  isFragile!: boolean;

  @Column({ name: 'delivery_fee', type: 'decimal', precision: 12, scale: 2, default: '0.00' })
  deliveryFee!: string;

  @Column({ name: 'cod_amount', type: 'decimal', precision: 12, scale: 2, default: '0.00' })
  codAmount!: string;

  @Column({ name: 'lifecycle_status', type: 'enum', enum: PARCEL_STATUSES, default: 'draft' })
  lifecycleStatus!: ParcelStatus;

  @Column({ name: 'delivery_attempt_count', type: 'tinyint', unsigned: true, default: 0 })
  deliveryAttemptCount!: number;

  @Column({ name: 'failed_reason_code', type: 'varchar', length: 64, nullable: true })
  failedReasonCode!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;
}

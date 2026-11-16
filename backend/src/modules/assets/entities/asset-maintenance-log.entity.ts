import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Mirrors `asset_maintenance_logs`: one service of an asset. DECIMAL columns stay strings; DATE columns are
// 'YYYY-MM-DD' strings.
@Entity('asset_maintenance_logs')
export class AssetMaintenanceLog {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'asset_id', type: 'bigint', unsigned: true })
  assetId!: string;

  @Column({ name: 'service_date', type: 'date' })
  serviceDate!: string;

  @Column({ name: 'service_type', type: 'varchar', length: 128 })
  serviceType!: string;

  @Column({ name: 'service_cost', type: 'decimal', precision: 12, scale: 2, default: '0.00' })
  serviceCost!: string;

  @Column({ name: 'vendor_service_center', type: 'varchar', length: 128, nullable: true })
  vendorServiceCenter!: string | null;

  @Column({ name: 'next_service_due', type: 'date', nullable: true })
  nextServiceDue!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;
}

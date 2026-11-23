import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Mirrors `asset_assignments`: one check-out of an asset to a driver (a delivery_drivers employee id). The row
// without checked_in_at is who has the asset now; the repository keeps it to one per asset.
@Entity('asset_assignments')
export class AssetAssignment {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'asset_id', type: 'bigint', unsigned: true })
  assetId!: string;

  @Column({ name: 'driver_id', type: 'bigint', unsigned: true })
  driverId!: string;

  @Column({ name: 'checked_out_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  checkedOutAt!: Date;

  @Column({ name: 'checked_in_at', type: 'timestamp', nullable: true })
  checkedInAt!: Date | null;

  @Column({ name: 'checkout_notes', type: 'text', nullable: true })
  checkoutNotes!: string | null;

  @Column({ name: 'checkin_notes', type: 'text', nullable: true })
  checkinNotes!: string | null;
}

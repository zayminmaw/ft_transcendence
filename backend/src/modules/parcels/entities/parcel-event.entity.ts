import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { PARCEL_STATUSES, type ParcelStatus } from '../constants';

// Mirrors `parcel_events`: one row per step of a parcel's history, never changed afterwards. An assignment keeps the
// driver, vehicle and run it went out with; a failed attempt keeps its reason code.
@Entity('parcel_events')
export class ParcelEvent {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'parcel_id', type: 'bigint', unsigned: true })
  parcelId!: string;

  @Column({ name: 'actor_user_id', type: 'bigint', unsigned: true, nullable: true })
  actorUserId!: string | null;

  @Column({ type: 'enum', enum: PARCEL_STATUSES })
  status!: ParcelStatus;

  @Column({ name: 'hub_location', type: 'varchar', length: 128, nullable: true })
  hubLocation!: string | null;

  @Column({ name: 'driver_id', type: 'bigint', unsigned: true, nullable: true })
  driverId!: string | null;

  @Column({ name: 'asset_id', type: 'bigint', unsigned: true, nullable: true })
  assetId!: string | null;

  @Column({ name: 'dispatch_run_id', type: 'bigint', unsigned: true, nullable: true })
  dispatchRunId!: string | null;

  @Column({ name: 'reason_code', type: 'varchar', length: 64, nullable: true })
  reasonCode!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'event_timestamp', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  eventTimestamp!: Date;
}

import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// Mirrors `clients`: one merchant account of one company. DECIMAL columns stay strings. Balances change only through
// billing's ledger entries, never through the clients module.
@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'organization_id', type: 'bigint', unsigned: true })
  organizationId!: string;

  @Column({ name: 'client_code', type: 'varchar', length: 32 })
  clientCode!: string;

  @Column({ name: 'business_name', type: 'varchar', length: 191 })
  businessName!: string;

  @Column({ name: 'trade_license_no', type: 'varchar', length: 128, nullable: true })
  tradeLicenseNo!: string | null;

  @Column({ name: 'contact_person_name', type: 'varchar', length: 128 })
  contactPersonName!: string;

  @Column({ name: 'contact_title', type: 'varchar', length: 64, nullable: true })
  contactTitle!: string | null;

  @Column({ name: 'mobile_1', type: 'varchar', length: 32 })
  mobile1!: string;

  @Column({ name: 'mobile_2', type: 'varchar', length: 32, nullable: true })
  mobile2!: string | null;

  @Column({ type: 'varchar', length: 191 })
  email!: string;

  @Column({ name: 'billing_address', type: 'text' })
  billingAddress!: string;

  @Column({ name: 'default_pickup_address', type: 'text' })
  defaultPickupAddress!: string;

  @Column({ name: 'pickup_latitude', type: 'decimal', precision: 10, scale: 8, nullable: true })
  pickupLatitude!: string | null;

  @Column({ name: 'pickup_longitude', type: 'decimal', precision: 11, scale: 8, nullable: true })
  pickupLongitude!: string | null;

  @Column({ name: 'current_balance', type: 'decimal', precision: 12, scale: 2, default: '0.00' })
  currentBalance!: string;

  @Column({ name: 'pending_cod_balance', type: 'decimal', precision: 12, scale: 2, default: '0.00' })
  pendingCodBalance!: string;

  @Column({ name: 'rate_profile_tier', type: 'varchar', length: 32, default: 'standard' })
  rateProfileTier!: string;

  @Column({ name: 'operational_notes', type: 'text', nullable: true })
  operationalNotes!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;
}

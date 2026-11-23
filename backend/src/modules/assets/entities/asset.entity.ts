import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ASSET_CATEGORIES, ASSET_CONDITIONS, type AssetCategory, type AssetCondition } from '../constants';

// Mirrors `assets`: one vehicle or piece of equipment of one company. The asset tag is unique per company. DECIMAL
// columns stay strings; DATE columns are 'YYYY-MM-DD' strings.
@Entity('assets')
export class Asset {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'organization_id', type: 'bigint', unsigned: true })
  organizationId!: string;

  @Column({ name: 'asset_tag', type: 'varchar', length: 64 })
  assetTag!: string;

  @Column({ name: 'asset_name', type: 'varchar', length: 128 })
  assetName!: string;

  @Column({ type: 'enum', enum: ASSET_CATEGORIES })
  category!: AssetCategory;

  @Column({ name: 'acquisition_cost', type: 'decimal', precision: 12, scale: 2, default: '0.00' })
  acquisitionCost!: string;

  @Column({ name: 'current_book_value', type: 'decimal', precision: 12, scale: 2, default: '0.00' })
  currentBookValue!: string;

  @Column({ name: 'license_plate', type: 'varchar', length: 32, nullable: true })
  licensePlate!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  vin!: string | null;

  @Column({ name: 'insurance_policy_number', type: 'varchar', length: 64, nullable: true })
  insurancePolicyNumber!: string | null;

  @Column({ name: 'road_tax_expiry', type: 'date', nullable: true })
  roadTaxExpiry!: string | null;

  @Column({ name: 'current_condition', type: 'enum', enum: ASSET_CONDITIONS, default: 'good' })
  currentCondition!: AssetCondition;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;
}

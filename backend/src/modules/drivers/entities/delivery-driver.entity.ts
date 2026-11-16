import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { Employee } from './employee.entity';

export const DRIVER_CATEGORIES = ['motorcycle', 'van', 'heavy_truck', 'bicycle'] as const;
export const FLEET_ARRANGEMENTS = ['company_vehicle', 'owner_operator'] as const;
export const DISPATCH_STATUSES = ['off_duty', 'available', 'on_pickup', 'out_for_delivery', 'suspended'] as const;
export type DispatchStatus = (typeof DISPATCH_STATUSES)[number];

// Mirrors `delivery_drivers`: the courier part of a driver's `employees` row. organization_id always equals the
// employee's (composite foreign key); the license number is unique per company.
@Entity('delivery_drivers')
export class DeliveryDriver {
  @PrimaryColumn({ name: 'employee_id', type: 'bigint', unsigned: true })
  employeeId!: string;

  @Column({ name: 'organization_id', type: 'bigint', unsigned: true })
  organizationId!: string;

  @Column({ name: 'driver_category', type: 'enum', enum: DRIVER_CATEGORIES })
  driverCategory!: (typeof DRIVER_CATEGORIES)[number];

  @Column({ name: 'fleet_arrangement', type: 'enum', enum: FLEET_ARRANGEMENTS })
  fleetArrangement!: (typeof FLEET_ARRANGEMENTS)[number];

  @Column({ name: 'commission_per_drop', type: 'decimal', precision: 12, scale: 2, default: '0.00' })
  commissionPerDrop!: string;

  @Column({ name: 'license_number', type: 'varchar', length: 64 })
  licenseNumber!: string;

  @Column({ name: 'license_class', type: 'varchar', length: 32 })
  licenseClass!: string;

  @Column({ name: 'license_expiry_date', type: 'date' })
  licenseExpiryDate!: string;

  @Column({ name: 'background_check_passed', type: 'boolean', default: false })
  backgroundCheckPassed!: boolean;

  @Column({ name: 'background_check_date', type: 'date', nullable: true })
  backgroundCheckDate!: string | null;

  @Column({ name: 'transit_insurance_policy', type: 'varchar', length: 64, nullable: true })
  transitInsurancePolicy!: string | null;

  @Column({ name: 'transit_insurance_expiry', type: 'date', nullable: true })
  transitInsuranceExpiry!: string | null;

  @Column({ name: 'assigned_zone', type: 'varchar', length: 64, nullable: true })
  assignedZone!: string | null;

  @Column({ name: 'max_weight_capacity_kg', type: 'decimal', precision: 8, scale: 2, default: '0.00' })
  maxWeightCapacityKg!: string;

  @Column({ name: 'max_volume_capacity_m3', type: 'decimal', precision: 8, scale: 2, default: '0.00' })
  maxVolumeCapacityM3!: string;

  @Column({ name: 'dispatch_status', type: 'enum', enum: DISPATCH_STATUSES, default: 'off_duty' })
  dispatchStatus!: DispatchStatus;

  @Column({ name: 'current_latitude', type: 'decimal', precision: 10, scale: 8, nullable: true })
  currentLatitude!: string | null;

  @Column({ name: 'current_longitude', type: 'decimal', precision: 11, scale: 8, nullable: true })
  currentLongitude!: string | null;

  @Column({ name: 'last_location_ping', type: 'timestamp', nullable: true })
  lastLocationPing!: Date | null;

  @OneToOne(() => Employee, (employee) => employee.driver)
  @JoinColumn({ name: 'employee_id' })
  employee?: Employee;
}

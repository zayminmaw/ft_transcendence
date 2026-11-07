import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { DeliveryDriver } from './delivery-driver.entity';

export const DEPARTMENTS = ['executive', 'hr', 'finance', 'operations', 'field_logistics'] as const;
export const PERSONNEL_TYPES = ['internal_staff', 'driver'] as const;
export const EMPLOYMENT_CLASSIFICATIONS = ['full_time', 'part_time', 'contractor', 'owner'] as const;
export const COMPENSATION_TYPES = ['fixed_salary', 'hourly', 'commission_only', 'hybrid'] as const;
export const EMPLOYMENT_STATUSES = ['active', 'on_leave', 'probation', 'terminated'] as const;

// Mirrors `employees`: one person employed by one company, staff or driver. A driver also has a `delivery_drivers`
// row. DECIMAL columns stay strings; DATE columns are 'YYYY-MM-DD' strings.
@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'organization_id', type: 'bigint', unsigned: true })
  organizationId!: string;

  // The login account, unique per company.
  @Column({ name: 'user_id', type: 'bigint', unsigned: true, nullable: true })
  userId!: string | null;

  @Column({ name: 'employee_code', type: 'varchar', length: 32 })
  employeeCode!: string;

  @Column({ name: 'first_name', type: 'varchar', length: 64 })
  firstName!: string;

  @Column({ name: 'last_name', type: 'varchar', length: 64 })
  lastName!: string;

  @Column({ type: 'enum', enum: DEPARTMENTS })
  department!: (typeof DEPARTMENTS)[number];

  @Column({ name: 'personnel_type', type: 'enum', enum: PERSONNEL_TYPES })
  personnelType!: (typeof PERSONNEL_TYPES)[number];

  @Column({ name: 'employment_classification', type: 'enum', enum: EMPLOYMENT_CLASSIFICATIONS })
  employmentClassification!: (typeof EMPLOYMENT_CLASSIFICATIONS)[number];

  @Column({ name: 'compensation_type', type: 'enum', enum: COMPENSATION_TYPES })
  compensationType!: (typeof COMPENSATION_TYPES)[number];

  @Column({ name: 'base_salary', type: 'decimal', precision: 12, scale: 2, default: '0.00' })
  baseSalary!: string;

  @Column({ name: 'bank_account_iban', type: 'varchar', length: 64, nullable: true })
  bankAccountIban!: string | null;

  @Column({ name: 'bank_name', type: 'varchar', length: 128, nullable: true })
  bankName!: string | null;

  @Column({ name: 'national_id', type: 'varchar', length: 64 })
  nationalId!: string;

  @Column({ name: 'date_of_birth', type: 'date' })
  dateOfBirth!: string;

  @Column({ name: 'personal_mobile', type: 'varchar', length: 32 })
  personalMobile!: string;

  @Column({ name: 'personal_email', type: 'varchar', length: 191 })
  personalEmail!: string;

  @Column({ name: 'residential_address', type: 'text' })
  residentialAddress!: string;

  @Column({ name: 'emergency_contact_name', type: 'varchar', length: 128 })
  emergencyContactName!: string;

  @Column({ name: 'emergency_contact_phone', type: 'varchar', length: 32 })
  emergencyContactPhone!: string;

  @Column({ name: 'employment_status', type: 'enum', enum: EMPLOYMENT_STATUSES, default: 'active' })
  employmentStatus!: (typeof EMPLOYMENT_STATUSES)[number];

  @Column({ name: 'hire_date', type: 'date' })
  hireDate!: string;

  @Column({ name: 'termination_date', type: 'date', nullable: true })
  terminationDate!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user?: User | null;

  @OneToOne(() => DeliveryDriver, (driver) => driver.employee)
  driver?: DeliveryDriver;
}

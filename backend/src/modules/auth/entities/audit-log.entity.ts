import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Mirrors the shared `audit_logs` table. Auth is its first writer; move this entity to a shared place when another
// module starts writing audit rows.
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'organization_id', type: 'bigint', unsigned: true, nullable: true })
  organizationId!: string | null;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true, nullable: true })
  userId!: string | null;

  @Column({ type: 'varchar', length: 64 })
  module!: string;

  @Column({ type: 'varchar', length: 64 })
  action!: string;

  @Column({ name: 'record_id', type: 'varchar', length: 64, nullable: true })
  recordId!: string | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress!: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 255, nullable: true })
  userAgent!: string | null;

  @Column({ name: 'old_values', type: 'json', nullable: true })
  oldValues!: unknown;

  @Column({ name: 'new_values', type: 'json', nullable: true })
  newValues!: unknown;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;
}

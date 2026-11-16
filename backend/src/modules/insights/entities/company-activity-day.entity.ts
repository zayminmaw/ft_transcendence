import { Column, Entity, PrimaryColumn } from 'typeorm';

// Mirrors `company_activity_days`: a member had a company open on a (UTC) day, and opened it `visits` times. Only the
// insights repository writes it; the migration owns the schema and the cascades.
@Entity('company_activity_days')
export class CompanyActivityDay {
  @PrimaryColumn({ name: 'organization_id', type: 'bigint', unsigned: true })
  organizationId!: string;

  @PrimaryColumn({ name: 'user_id', type: 'bigint', unsigned: true })
  userId!: string;

  // YYYY-MM-DD, kept as text so no time zone can move it to another day.
  @PrimaryColumn({ type: 'date' })
  day!: string;

  @Column({ type: 'int', unsigned: true, default: 0 })
  visits!: number;
}

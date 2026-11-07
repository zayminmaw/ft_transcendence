import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Mirrors `contacts`: one member of a company has saved another member of the same company. The migration keeps both
// memberships inside organization_id; this entity only names the columns.
@Entity('contacts')
export class Contact {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'organization_id', type: 'bigint', unsigned: true })
  organizationId!: string;

  @Column({ name: 'owner_member_id', type: 'bigint', unsigned: true })
  ownerMemberId!: string;

  @Column({ name: 'contact_member_id', type: 'bigint', unsigned: true })
  contactMemberId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;
}

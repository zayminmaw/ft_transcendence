import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Mirrors `member_invites`. Single-use invite links scoped to one organization and one assignable role.
@Entity('member_invites')
export class MemberInvite {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'organization_id', type: 'bigint', unsigned: true })
  organizationId!: string;

  @Column({ name: 'role_id', type: 'int', unsigned: true })
  roleId!: number;

  @Column({ name: 'invited_by_user_id', type: 'bigint', unsigned: true })
  invitedByUserId!: string;

  @Column({ type: 'varchar', length: 191, nullable: true })
  email!: string | null;

  @Column({ name: 'token_hash', type: 'char', length: 64, unique: true })
  tokenHash!: string;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt!: Date;

  @Column({ name: 'used_at', type: 'timestamp', nullable: true })
  usedAt!: Date | null;

  @Column({ name: 'used_by_user_id', type: 'bigint', unsigned: true, nullable: true })
  usedByUserId!: string | null;

  @Column({ name: 'revoked_at', type: 'timestamp', nullable: true })
  revokedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;
}


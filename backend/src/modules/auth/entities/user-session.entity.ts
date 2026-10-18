import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type RevokeReason = 'logout' | 'reuse' | 'inactive';

// Mirrors `user_sessions` (migration 1792195200000): one row per login on a device.
@Entity('user_sessions')
export class UserSession {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true })
  userId!: string;

  // SHA-256 of the refresh token; the token itself only lives in the cookie.
  @Column({ name: 'token_hash', type: 'char', length: 64, unique: true })
  tokenHash!: string;

  @Column({ name: 'previous_token_hash', type: 'char', length: 64, nullable: true })
  previousTokenHash!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @Column({ name: 'last_used_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  lastUsedAt!: Date;

  @Column({ name: 'idle_expires_at', type: 'timestamp' })
  idleExpiresAt!: Date;

  @Column({ name: 'absolute_expires_at', type: 'timestamp' })
  absoluteExpiresAt!: Date;

  @Column({ name: 'revoked_at', type: 'timestamp', nullable: true })
  revokedAt!: Date | null;

  @Column({ name: 'revoked_reason', type: 'varchar', length: 32, nullable: true })
  revokedReason!: RevokeReason | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 255, nullable: true })
  userAgent!: string | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress!: string | null;
}

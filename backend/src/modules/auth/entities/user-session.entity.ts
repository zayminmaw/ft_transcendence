import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type RevokeReason = 'logout' | 'reuse' | 'inactive';

// Mirrors `user_sessions` (migrations 1792195200000, 1792281600000 and 1792454400000): one row per login on a device.
@Entity('user_sessions')
export class UserSession {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true })
  userId!: string;

  // Random, never changes: the first part of the refresh token ("<familyId>.<secret>").
  @Column({ name: 'family_id', type: 'char', length: 22, unique: true })
  familyId!: string;

  // SHA-256 of the current secret; the secret itself only lives in the cookie.
  @Column({ name: 'token_hash', type: 'char', length: 64, unique: true })
  tokenHash!: string;

  // The secret the current one replaced, and when. A browser that missed that refresh's answer still holds it, so it
  // keeps working for a few seconds (SessionsService.refresh).
  @Column({ name: 'previous_token_hash', type: 'char', length: 64, nullable: true })
  previousTokenHash!: string | null;

  @Column({ name: 'rotated_at', type: 'timestamp', nullable: true })
  rotatedAt!: Date | null;

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

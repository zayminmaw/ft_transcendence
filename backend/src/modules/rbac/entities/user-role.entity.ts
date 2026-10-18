import { CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Role } from './role.entity';

// Mirrors `user_roles`: global roles, today only platform_admin (platform access), never a company role.
@Entity('user_roles')
export class UserRole {
  @PrimaryColumn({ name: 'user_id', type: 'bigint', unsigned: true })
  userId!: string;

  @PrimaryColumn({ name: 'role_id', type: 'int', unsigned: true })
  roleId!: number;

  @CreateDateColumn({ name: 'assigned_at', type: 'timestamp' })
  assignedAt!: Date;

  @ManyToOne(() => Role)
  @JoinColumn({ name: 'role_id' })
  role!: Role;
}

import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Permission } from './permission.entity';
import { Role } from './role.entity';

// Mirrors `role_permissions`: which permissions a role has, and whether for everything or only "their own".
@Entity('role_permissions')
export class RolePermission {
  @PrimaryColumn({ name: 'role_id', type: 'int', unsigned: true })
  roleId!: number;

  @PrimaryColumn({ name: 'permission_id', type: 'int', unsigned: true })
  permissionId!: number;

  @Column({ type: 'enum', enum: ['all', 'assigned_only'], default: 'all' })
  scope!: 'all' | 'assigned_only';

  @ManyToOne(() => Role)
  @JoinColumn({ name: 'role_id' })
  role!: Role;

  @ManyToOne(() => Permission)
  @JoinColumn({ name: 'permission_id' })
  permission!: Permission;
}

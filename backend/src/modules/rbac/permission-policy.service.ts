import { Injectable } from '@nestjs/common';
import { PermissionsRepository } from './permissions.repository';

@Injectable()
export class PermissionPolicyService {
	constructor(private readonly permissions: PermissionsRepository) {}

	// The one rule for HTTP (RolesGuard) and notifications: assigned_only is denied until resource ownership
	// policies exist.
	async canAccess(roleId: string, permission: string): Promise<boolean> {
		return (await this.permissions.findScope(roleId, permission)) === 'all';
	}
}

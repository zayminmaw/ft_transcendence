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

	// The same rule for several permissions at once: the ones the role may use.
	allowedOf(roleId: string, permissions: readonly string[]): Promise<Set<string>> {
		return this.permissions.grantedOf(roleId, permissions);
	}
}

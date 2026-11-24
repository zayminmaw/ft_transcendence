import { Injectable } from '@nestjs/common';
import { PermissionsRepository } from './permissions.repository';

@Injectable()
export class PermissionPolicyService {
	constructor(private readonly permissions: PermissionsRepository) {}

	// Full-scope HTTP routes (RolesGuard) and tenant-wide notifications use this rule. Assigned parcel routes use
	// their own guard and resource ownership checks; a partial grant must never open a tenant-wide room.
	async canAccess(roleId: string, permission: string): Promise<boolean> {
		return (await this.permissions.findScope(roleId, permission)) === 'all';
	}

	// The same rule for several permissions at once: the ones the role may use.
	allowedOf(roleId: string, permissions: readonly string[]): Promise<Set<string>> {
		return this.permissions.grantedOf(roleId, permissions);
	}
}

import type { DataSource } from 'typeorm';
import { UserRole } from '../modules/rbac/entities/user-role.entity';
import { PlatformRolesRepository } from '../modules/rbac/platform-roles.repository';
import { AccountError, createAccount } from '../modules/users/accounts';

export interface PlatformAdminInput {
  username: string;
  email: string;
  password: string;
}

export class PlatformAdminError extends Error {}

// Creates a new account with the platform_admin role. Never reuses or changes an existing account. The person typed
// their own password, so they don't have to change it at the first login.
export async function createPlatformAdmin(database: DataSource, input: PlatformAdminInput): Promise<string> {
  const platformRoles = new PlatformRolesRepository(database.getRepository(UserRole));
  try {
    return await database.transaction(async (manager) => {
      const userId = await createAccount(manager, { ...input, mustChangePassword: false });
      await platformRoles.grantPlatformAdmin(userId, manager);
      return userId;
    });
  } catch (error) {
    if (error instanceof AccountError) throw new PlatformAdminError(`${error.message} Nothing was changed.`);
    throw error;
  }
}

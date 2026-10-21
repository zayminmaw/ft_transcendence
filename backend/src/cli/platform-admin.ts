import type { DataSource } from 'typeorm';
import { hashPassword, passwordProblems } from '../modules/auth/password';
import { UserRole } from '../modules/rbac/entities/user-role.entity';
import { PlatformRolesRepository } from '../modules/rbac/platform-roles.repository';
import { EMAIL_MAX_LENGTH, EMAIL_PATTERN, EMAIL_RULE, PASSWORD_RULE, USERNAME_PATTERN, USERNAME_RULE } from '../modules/users/account-rules';
import { User } from '../modules/users/entities/user.entity';

export interface PlatformAdminInput {
  username: string;
  email: string;
  password: string;
}

export class PlatformAdminError extends Error {}

// Creates a new account with the platform_admin role. Never reuses or changes an existing account.
export async function createPlatformAdmin(database: DataSource, input: PlatformAdminInput): Promise<string> {
  const username = input.username.trim();
  const email = input.email.trim();
  if (!USERNAME_PATTERN.test(username)) throw new PlatformAdminError(USERNAME_RULE);
  if (!EMAIL_PATTERN.test(email) || email.length > EMAIL_MAX_LENGTH) throw new PlatformAdminError(EMAIL_RULE);
  if (passwordProblems(input.password).length > 0) throw new PlatformAdminError(PASSWORD_RULE);
  const passwordHash = await hashPassword(input.password);
  const platformRoles = new PlatformRolesRepository(database.getRepository(UserRole));
  return database.transaction(async (manager) => {
    if (await manager.existsBy(User, [{ username }, { email }])) {
      throw new PlatformAdminError('That username or email already belongs to an account. Nothing was changed.');
    }
    const user = await manager.save(manager.create(User, { username, email, passwordHash }));
    await platformRoles.grantPlatformAdmin(user.id, manager);
    return user.id;
  });
}

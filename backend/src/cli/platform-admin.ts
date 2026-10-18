import type { DataSource } from 'typeorm';
import { hashPassword, passwordProblems } from '../modules/auth/password';
import { UserRole } from '../modules/rbac/entities/user-role.entity';
import { PlatformRolesRepository } from '../modules/rbac/platform-roles.repository';
import { User } from '../modules/users/entities/user.entity';

export interface PlatformAdminInput {
  username: string;
  email: string;
  password: string;
}

export class PlatformAdminError extends Error {}

const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,64}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Creates a new account with the platform_admin role. Never reuses or changes an existing account.
export async function createPlatformAdmin(database: DataSource, input: PlatformAdminInput): Promise<string> {
  const username = input.username.trim();
  const email = input.email.trim();
  if (!USERNAME_PATTERN.test(username)) throw new PlatformAdminError('Username: 3-64 letters, numbers, dots, dashes or underscores.');
  if (!EMAIL_PATTERN.test(email) || email.length > 191) throw new PlatformAdminError('Email: enter a valid address.');
  if (passwordProblems(input.password).length > 0) {
    throw new PlatformAdminError('Password: 8-128 characters with an upper-case letter, a lower-case letter, a number and a symbol.');
  }
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

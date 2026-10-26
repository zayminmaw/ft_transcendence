import type { EntityManager } from 'typeorm';
import { User } from './entities/user.entity';
import { hashPassword, PASSWORD_RULE_MESSAGE, passwordProblems } from './password';

export interface NewAccount {
  username: string;
  email: string;
  password: string;
  mustChangePassword: boolean;
}

export type AccountProblem = 'username' | 'email' | 'password' | 'taken';

export class AccountError extends Error {
  constructor(readonly problem: AccountProblem, message: string) {
    super(message);
  }
}

const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,64}$/;
// Printable ASCII only: login refuses anything else, so an account with an accented email could never log in by email.
const EMAIL_PATTERN = /^[\x21-\x3F\x41-\x7E]+@[\x21-\x3F\x41-\x7E]+\.[\x21-\x3F\x41-\x7E]+$/;

function isDuplicateKey(error: unknown): boolean {
  const driver = (error as { driverError?: { errno?: number; code?: string } }).driverError;
  return driver?.errno === 1062 || driver?.code === 'ER_DUP_ENTRY';
}

// The one way to create an account (company admins, tenant onboarding, the first-admin command), inside the caller's
// transaction. Never attaches to, overwrites or resets an existing account. Returns the new user's id.
export async function createAccount(manager: EntityManager, input: NewAccount): Promise<string> {
  const username = input.username.trim();
  const email = input.email.trim();
  if (!USERNAME_PATTERN.test(username)) {
    throw new AccountError('username', 'Usernames need 3-64 letters, numbers, dots, dashes or underscores.');
  }
  if (email.length > 191 || !EMAIL_PATTERN.test(email)) {
    throw new AccountError('email', 'Enter a valid email address without spaces or accented letters.');
  }
  if (passwordProblems(input.password).length > 0) throw new AccountError('password', PASSWORD_RULE_MESSAGE);
  const taken = new AccountError('taken', 'That username or email is already in use.');
  // The columns compare without case or accents, so "Dana.Saleh" and "dana.saleh" are the same name.
  if (await manager.existsBy(User, [{ username }, { email }])) throw taken;
  const passwordHash = await hashPassword(input.password);
  try {
    const user = await manager.save(manager.create(User, { username, email, passwordHash, mustChangePassword: input.mustChangePassword }));
    return user.id;
  } catch (error) {
    // Another request created the same name between the check and the insert: the unique index refuses it.
    if (isDuplicateKey(error)) throw taken;
    throw error;
  }
}

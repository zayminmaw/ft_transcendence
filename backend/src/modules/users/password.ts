import { argon2id, hash, verify } from 'argon2';
import { randomInt } from 'node:crypto';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const PASSWORD_RULE_MESSAGE =
  'Passwords need 8-128 characters with an upper-case letter, a lower-case letter, a number and a symbol.';

export type PasswordProblem = 'length' | 'lowercase' | 'uppercase' | 'number' | 'symbol';

// waiyan's rule (2026-10-15): 8-128 characters with a lower-case letter, an upper-case letter, a number and a symbol.
export function passwordProblems(password: string): PasswordProblem[] {
  const problems: PasswordProblem[] = [];
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) problems.push('length');
  if (!/[a-z]/.test(password)) problems.push('lowercase');
  if (!/[A-Z]/.test(password)) problems.push('uppercase');
  if (!/[0-9]/.test(password)) problems.push('number');
  if (!/[^A-Za-z0-9]/.test(password)) problems.push('symbol');
  return problems;
}

export function hashPassword(password: string): Promise<string> {
  return hash(password, { type: argon2id });
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

// No look-alikes (0/O, 1/l/I), so it can be read out or copied by hand without mistakes.
const TEMPORARY_SETS = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!#$%&*+-=?@'];

// A one-time password an admin hands over after a reset: 16 characters, at least one from each set, so it always
// passes the rule. The person must replace it at their next login.
export function temporaryPassword(): string {
  const all = TEMPORARY_SETS.join('');
  const characters = TEMPORARY_SETS.map((set) => set[randomInt(set.length)]);
  while (characters.length < 16) characters.push(all[randomInt(all.length)]);
  for (let i = characters.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [characters[i], characters[j]] = [characters[j], characters[i]];
  }
  return characters.join('');
}

import { argon2id, hash, verify } from 'argon2';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

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

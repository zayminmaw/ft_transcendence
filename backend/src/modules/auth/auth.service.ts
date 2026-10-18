import { Injectable, type OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { type User, UsersRepository } from '../users';
import { AuthAuditRepository } from './auth-audit.repository';
import { hashPassword, verifyPassword } from './password';
import type { RequestMeta } from './request-meta';

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyHash = '';

  constructor(private readonly users: UsersRepository, private readonly audit: AuthAuditRepository) {}

  // An unknown login is checked against this hash, so it takes as long as a wrong password.
  async onModuleInit() {
    this.dummyHash = await hashPassword(randomBytes(16).toString('hex'));
  }

  // Unknown login, wrong password and inactive account all return undefined: the caller can't tell them apart.
  async verifyLogin(login: string, password: string, meta: RequestMeta): Promise<User | undefined> {
    const user = await this.users.findByLogin(login.trim());
    const passwordMatches = await verifyPassword(user?.passwordHash ?? this.dummyHash, password);
    if (!user || !passwordMatches || !user.isActive) {
      await this.audit.record('login_failed', user?.id ?? null, meta);
      return undefined;
    }
    await this.users.touchLastLogin(user.id);
    await this.audit.record('login', user.id, meta);
    return user;
  }
}

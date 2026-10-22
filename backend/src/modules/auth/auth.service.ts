import { BadRequestException, Injectable, type OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { hashPassword, PASSWORD_RULE_MESSAGE, passwordProblems, type User, UsersRepository, verifyPassword } from '../users';
import { AuthAuditRepository } from './auth-audit.repository';
import type { RequestMeta } from './request-meta';
import { SessionsService } from './sessions.service';

const WRONG_PASSWORD = { message: 'Your current password is wrong.', code: 'AUTH_WRONG_PASSWORD' };
const PASSWORD_UNCHANGED = { message: 'Choose a password different from your current one.', code: 'PASSWORD_UNCHANGED' };

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyHash = '';

  constructor(
    private readonly users: UsersRepository,
    private readonly audit: AuthAuditRepository,
    private readonly sessions: SessionsService,
  ) {}

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

  // The current password proves it's you (400, not 401: the frontend reads a 401 as an expired token). Clears the
  // must-change flag and ends your other sessions; the one whose refresh token came with the request stays.
  async changePassword(
    userId: string,
    passwords: { currentPassword: string; newPassword: string },
    refreshToken: string | undefined,
    meta: RequestMeta,
  ): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user || !(await verifyPassword(user.passwordHash, passwords.currentPassword))) {
      throw new BadRequestException(WRONG_PASSWORD);
    }
    if (passwordProblems(passwords.newPassword).length > 0) {
      throw new BadRequestException({ message: PASSWORD_RULE_MESSAGE, code: 'PASSWORD_RULE' });
    }
    if (passwords.newPassword === passwords.currentPassword) throw new BadRequestException(PASSWORD_UNCHANGED);
    await this.users.updatePassword(userId, await hashPassword(passwords.newPassword), false);
    await this.sessions.endOthers(userId, refreshToken, 'password_change');
    await this.audit.record('password_changed', userId, meta);
  }
}

import { BadRequestException, Injectable, Logger, type OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { StorageService, type UploadedFileInput } from '../storage';
import { hashPassword, PASSWORD_RULE_MESSAGE, passwordProblems, type User, UsersRepository, verifyPassword } from '../users';
import { AuthAuditRepository } from './auth-audit.repository';
import type { RequestMeta } from './request-meta';
import { SessionsService } from './sessions.service';

const WRONG_PASSWORD = { message: 'Your current password is wrong.', code: 'AUTH_WRONG_PASSWORD' };
const PASSWORD_UNCHANGED = { message: 'Choose a password different from your current one.', code: 'PASSWORD_UNCHANGED' };
const SESSION_EXPIRED = { message: 'Your session has ended. Log in again.', code: 'AUTH_SESSION_EXPIRED' };

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyHash = '';
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersRepository,
    private readonly audit: AuthAuditRepository,
    private readonly sessions: SessionsService,
    private readonly storage: StorageService,
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
    const newHash = await hashPassword(passwords.newPassword);
    // A reset or another change saved since the check means the password checked here is no longer the current one.
    if (!(await this.users.updatePasswordIfCurrent(userId, user.passwordHash, newHash))) {
      throw new BadRequestException(WRONG_PASSWORD);
    }
    await this.sessions.endOthers(userId, refreshToken, 'password_change');
    await this.audit.record('password_changed', userId, meta);
  }

  // Your display name: "" or null clears it, so your username shows. Audited only when it actually changes.
  async updateProfile(userId: string, displayName: string | null, meta: RequestMeta): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException(SESSION_EXPIRED);
    const wanted = displayName || null;
    const current = user.displayName ?? null;
    if (wanted === current) return user;
    const values = { oldValues: { displayName: current }, newValues: { displayName: wanted } };
    // Saved together with its audit row, so a failed audit can't leave a change that a retry would never record.
    await this.users.updateDisplayName(userId, wanted, (manager) =>
      this.audit.record('profile_updated', userId, meta, values, manager),
    );
    return { ...user, displayName: wanted };
  }

  // Your picture, replacing the one before. Saved as a file of your account, not of a company.
  async setAvatar(userId: string, file: UploadedFileInput, meta: RequestMeta): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException(SESSION_EXPIRED);
    const saved = await this.storage.saveAccountFile(userId, file);
    try {
      return await this.swapAvatar(user, saved.id, meta);
    } catch (error) {
      // Neither the picture nor its audit row was saved, so nothing points at the new file.
      await this.removeFile(saved.id);
      throw error;
    }
  }

  // Back to your initials. Without a picture there is nothing to do.
  async removeAvatar(userId: string, meta: RequestMeta): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException(SESSION_EXPIRED);
    if (!user.avatarFileId) return user;
    return this.swapAvatar(user, null, meta);
  }

  // Of two changes at once the first saved wins: the other removes its own new file and answers with what was saved.
  // Saved together with its audit row; the old picture's file goes only once the account no longer points at it.
  private async swapAvatar(user: User, avatarFileId: string | null, meta: RequestMeta): Promise<User> {
    const previous = user.avatarFileId ?? null;
    const values = { oldValues: { avatarFileId: previous }, newValues: { avatarFileId } };
    const saved = await this.users.updateAvatarIfCurrent(user.id, previous, avatarFileId, (manager) =>
      this.audit.record('profile_updated', user.id, meta, values, manager),
    );
    if (!saved) {
      if (avatarFileId) await this.removeFile(avatarFileId);
      return (await this.users.findById(user.id)) ?? user;
    }
    if (previous) await this.removeFile(previous);
    return { ...user, avatarFileId };
  }

  // The picture is already decided, so a file left on disk must not turn the answer into an error.
  private async removeFile(id: string): Promise<void> {
    await this.storage.deleteAccountFile(id).catch((error: unknown) => {
      this.logger.warn(`Could not delete account file ${id}: ${error instanceof Error ? error.message : 'unknown error'}`);
    });
  }
}

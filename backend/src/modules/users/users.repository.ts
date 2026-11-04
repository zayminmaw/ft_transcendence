import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type EntityManager, IsNull, Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersRepository {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  // A login containing "@" is an email; anything else is a username. The column collation ignores case.
  async findByLogin(login: string): Promise<User | undefined> {
    return (await this.users.findOneBy(login.includes('@') ? { email: login } : { username: login })) ?? undefined;
  }

  async findById(id: string): Promise<User | undefined> {
    return (await this.users.findOneBy({ id })) ?? undefined;
  }

  isActive(id: string): Promise<boolean> {
    return this.users.existsBy({ id, isActive: true });
  }

  async updatePassword(id: string, passwordHash: string, mustChangePassword: boolean): Promise<void> {
    await this.users.update({ id }, { passwordHash, mustChangePassword });
  }

  // One transaction with `alsoSave` (the change's audit row): if either fails, neither is saved.
  async updateDisplayName(id: string, displayName: string | null, alsoSave: (manager: EntityManager) => Promise<void>): Promise<void> {
    await this.users.manager.transaction(async (manager) => {
      await manager.update(User, { id }, { displayName });
      await alsoSave(manager);
    });
  }

  // Saved only while the picture is still the one that was read, so of two changes at once only one wins. One
  // transaction with `alsoSave` (the change's audit row), which runs only when the picture was saved. false when
  // nothing was saved.
  async updateAvatarIfCurrent(
    id: string,
    current: string | null,
    avatarFileId: string | null,
    alsoSave: (manager: EntityManager) => Promise<void>,
  ): Promise<boolean> {
    return this.users.manager.transaction(async (manager) => {
      const result = await manager.update(User, { id, avatarFileId: current ?? IsNull() }, { avatarFileId });
      if (result.affected !== 1) return false;
      await alsoSave(manager);
      return true;
    });
  }

  // Your own change: saved only while the stored hash is still the one that was checked, so a reset or another change
  // saved in between wins. false when nothing was saved.
  async updatePasswordIfCurrent(id: string, currentHash: string, passwordHash: string): Promise<boolean> {
    const result = await this.users.update({ id, passwordHash: currentHash }, { passwordHash, mustChangePassword: false });
    return result.affected === 1;
  }

  async touchLastLogin(id: string): Promise<void> {
    await this.users.update({ id }, { lastLoginAt: new Date() });
  }
}

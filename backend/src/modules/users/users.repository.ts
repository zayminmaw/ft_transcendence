import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

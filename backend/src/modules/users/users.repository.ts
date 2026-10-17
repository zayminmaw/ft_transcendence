import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';

export interface UserRecord {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  isActive: boolean;
}

export interface NewUser {
  username: string;
  email: string;
  passwordHash: string;
}

type UserRow = Omit<UserRecord, 'isActive'> & { isActive: number | boolean };

const USER_COLUMNS = 'CAST(id AS CHAR) AS id, username, email, password_hash AS passwordHash, is_active AS isActive';

@Injectable()
export class UsersRepository {
  constructor(private readonly database: DataSource) {}

  // A login containing "@" is an email; anything else is a username. The column collation ignores case.
  async findByLogin(login: string): Promise<UserRecord | undefined> {
    const column = login.includes('@') ? 'email' : 'username';
    const rows: UserRow[] = await this.database.query(`SELECT ${USER_COLUMNS} FROM users WHERE ${column} = ? LIMIT 1`, [login]);
    return rows[0] ? toUser(rows[0]) : undefined;
  }

  async findById(id: string): Promise<UserRecord | undefined> {
    const rows: UserRow[] = await this.database.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = ? LIMIT 1`, [id]);
    return rows[0] ? toUser(rows[0]) : undefined;
  }

  async isActive(id: string): Promise<boolean> {
    const rows: { isActive: number | boolean }[] = await this.database.query('SELECT is_active AS isActive FROM users WHERE id = ? LIMIT 1', [id]);
    return rows[0] ? Boolean(Number(rows[0].isActive)) : false;
  }

  async touchLastLogin(id: string): Promise<void> {
    await this.database.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
  }

  async usernameOrEmailTaken(username: string, email: string, manager: EntityManager = this.database.manager): Promise<boolean> {
    const rows: unknown[] = await manager.query('SELECT 1 FROM users WHERE username = ? OR email = ? LIMIT 1', [username, email]);
    return rows.length > 0;
  }

  async insert(user: NewUser, manager: EntityManager = this.database.manager): Promise<string> {
    const result: { insertId: number | string } = await manager.query(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)', [user.username, user.email, user.passwordHash],
    );
    return String(result.insertId);
  }
}

function toUser(row: UserRow): UserRecord {
  return { ...row, isActive: Boolean(Number(row.isActive)) };
}

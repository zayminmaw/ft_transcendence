import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';
import type { Environment } from '../common/config/environment';

type DatabaseEnvironment = Pick<Environment, 'DB_HOST' | 'DB_PORT' | 'DB_USER' | 'DB_PASS' | 'DB_NAME'>;

export function databaseOptions(env: DatabaseEnvironment): DataSourceOptions {
  return {
    type: 'mariadb',
    host: env.DB_HOST,
    port: env.DB_PORT,
    username: env.DB_USER,
    password: env.DB_PASS,
    database: env.DB_NAME,
    charset: 'utf8mb4_unicode_ci',
    timezone: 'Z',
    supportBigNumbers: true,
    bigNumberStrings: true,
    entities: [],
    migrations: [join(__dirname, 'migrations', '*.js')],
    migrationsTransactionMode: 'none',
    synchronize: false,
    migrationsRun: false,
    logging: false,
    extra: { connectionLimit: 10, decimalNumbers: false },
  };
}

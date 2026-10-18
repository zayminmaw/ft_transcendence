import 'reflect-metadata';
import { stdin } from 'node:process';
import database from '../database/data-source';
import { createPlatformAdmin, PlatformAdminError } from './platform-admin';
import { askHidden, askVisible, NEEDS_TERMINAL } from './prompt';

async function main() {
  if (!stdin.isTTY) throw new PlatformAdminError(NEEDS_TERMINAL);
  const [username, email] = await askVisible(['Username: ', 'Email: ']);
  const password = await askHidden('Password: ');
  if ((await askHidden('Password again: ')) !== password) throw new PlatformAdminError('The passwords do not match. Nothing was changed.');
  await database.initialize();
  try {
    const userId = await createPlatformAdmin(database, { username, email, password });
    console.log(`Created platform admin "${username.trim()}" (user ${userId}). They can log in at /login.`);
  } finally {
    await database.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'The command failed.');
  process.exitCode = 1;
});

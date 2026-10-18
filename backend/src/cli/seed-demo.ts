import 'reflect-metadata';
import database from '../database/data-source';
import { DEMO_PASSWORD, seedDemo } from '../database/seeders/demo.seed';

async function main() {
  const force = process.argv.includes('--force');
  if (process.env.NODE_ENV === 'production') {
    if (!force) {
      console.error('Refusing to load demo data with NODE_ENV=production. Add --force only on a demo or evaluation machine.');
      process.exitCode = 1;
      return;
    }
    console.warn('Warning: every demo account uses a password written in the README. Never do this on a real deployment.');
  }
  await database.initialize();
  try {
    const result = await seedDemo(database);
    console.log(`Demo data: ${result.companiesCreated} companies and ${result.accountsCreated} accounts added.`);
    if (result.accountsSkipped.length > 0) console.log(`Already there, left unchanged: ${result.accountsSkipped.join(', ')}.`);
    console.log(`Every demo account's password: ${DEMO_PASSWORD}`);
  } finally {
    await database.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'The command failed.');
  process.exitCode = 1;
});

import { client } from './connection';

try {
  for (const migration of ['0001_initial.sql', '0002_workshops.sql', '0003_domain_model.sql', '0004_cascade_deletions.sql']) {
    await client.unsafe(await Bun.file(`migrations/${migration}`).text());
  }
  console.log('Migração aplicada.');
} finally {
  await client.end();
}

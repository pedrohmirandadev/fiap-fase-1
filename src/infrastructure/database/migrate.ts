import postgres from 'postgres';

const client = postgres(process.env.DATABASE_URL ?? 'postgres://oficina:oficina_local@localhost:5432/oficina');
try {
  for (const migration of ['0001_initial.sql', '0002_workshops.sql', '0003_domain_model.sql', '0004_cascade_deletions.sql']) {
    await client.unsafe(await Bun.file(`migrations/${migration}`).text());
  }
  console.log('Migração aplicada.');
} finally {
  await client.end();
}

import postgres from 'postgres';
import { randomUUID } from 'node:crypto';
import { PgUnitOfWork, repositoryContext } from '../../src/infrastructure/database/pg-unit-of-work';
import { PgWorkOrderQueries } from '../../src/infrastructure/queries/work-order-queries';
import type { RepositoryEnvironment } from './repository-contract';

/** Banco real, schema privado por cenário e rollback até do DDL. */
export function createPostgresTestEnvironment() {
  const sql = postgres(process.env.DATABASE_URL ?? 'postgres://oficina:oficina_local@localhost:5432/oficina', {
    max: 1, connect_timeout: 5, onnotice: () => {}
  });
  return {
    close: () => sql.end(),
    async run(check: (env: RepositoryEnvironment, transaction: postgres.TransactionSql) => Promise<void>) {
      const rollback = new Error('rollback intencional do cenário');
      try {
        await sql.begin(async transaction => {
          const schema = `repository_test_${randomUUID().replaceAll('-', '')}`;
          await transaction.unsafe(`CREATE SCHEMA "${schema}"`);
          await transaction.unsafe(`SET LOCAL search_path TO "${schema}"`);
          for (const file of ['0001_initial.sql', '0002_workshops.sql', '0003_domain_model.sql', '0004_cascade_deletions.sql']) {
            await transaction.unsafe(await Bun.file(new URL(`../../migrations/${file}`, import.meta.url)).text());
          }
          await check({
            repositories: repositoryContext(transaction), unitOfWork: new PgUnitOfWork(transaction),
            workOrderQueries: new PgWorkOrderQueries(transaction),
            addAdmin: async user => { await transaction`INSERT INTO users (id, email, password_hash) VALUES (${user.id}, ${user.email}, ${user.passwordHash})`; },
            events: async () => [...await transaction`SELECT id, name, aggregate_type AS "aggregateType", aggregate_id AS "aggregateId", occurred_at AS "occurredAt", payload FROM domain_events ORDER BY sequence`] as Awaited<ReturnType<RepositoryEnvironment['events']>>
          }, transaction);
          throw rollback;
        });
      } catch (error) { if (error !== rollback) throw error; }
    }
  };
}

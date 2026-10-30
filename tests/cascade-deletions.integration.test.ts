import { afterAll, describe, expect, it } from 'bun:test';
import postgres from 'postgres';
import { randomUUID } from 'node:crypto';
import { PgUnitOfWork, repositoryContext } from '../src/infrastructure/database/pg-unit-of-work';
import { PgWorkOrderQueries } from '../src/infrastructure/queries/work-order-queries';
import { DeleteCustomer } from '../src/application/use-cases/customer/delete-customer';
import { registerCascadeDeletionTests, seedDeletionFixture, type DeletionEnvironment } from './support/cascade-deletion-contract';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL must be configured to run PostgreSQL integration tests');
const sql = postgres(databaseUrl, {
  max: 1, connect_timeout: 5, onnotice: () => {}
});
const rollback = new Error('Rollback do schema de teste');
const cascadeMigration = new URL('../migrations/0004_cascade_deletions.sql', import.meta.url);

/** Cada teste cria seu schema em uma transação e reverte inclusive o DDL. */
async function withPostgresSchema(
  check: (env: DeletionEnvironment, transaction: postgres.TransactionSql) => Promise<void>,
  applyCascade = true
): Promise<void> {
  try {
    await sql.begin(async transaction => {
      const schema = `cascade_test_${randomUUID().replaceAll('-', '')}`;
      await transaction.unsafe(`CREATE SCHEMA "${schema}"`);
      await transaction.unsafe(`SET LOCAL search_path TO "${schema}"`);
      for (const file of ['0001_initial.sql', '0002_workshops.sql', '0003_domain_model.sql']) {
        await transaction.unsafe(await Bun.file(new URL(`../migrations/${file}`, import.meta.url)).text());
      }
      if (applyCascade) await transaction.unsafe(await Bun.file(cascadeMigration).text());
      const unitOfWork = new PgUnitOfWork(transaction);
      const env: DeletionEnvironment = {
        repositories: repositoryContext(transaction), unitOfWork,
        workOrderQueries: new PgWorkOrderQueries(transaction),
        eventCount: async () => Number((await transaction`SELECT COUNT(*) AS count FROM domain_events`)[0].count)
      };
      await check(env, transaction);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}

afterAll(() => sql.end());

describe('PostgreSQL: exclusões isoladas por schema e rollback', () => {
  registerCascadeDeletionTests('contrato de cascata PostgreSQL', check => withPostgresSchema(check));

  it('atualiza banco com relacionamentos existentes e permite reaplicar a migração', () => withPostgresSchema(async (env, transaction) => {
    const data = await seedDeletionFixture(env);
    const events = await env.eventCount();
    await expect(transaction.savepoint(savepoint => new DeleteCustomer(repositoryContext(savepoint).customers).execute(data.customer.id!))).rejects.toMatchObject({ code: '23503' });
    await transaction.unsafe(await Bun.file(cascadeMigration).text());
    await transaction.unsafe(await Bun.file(cascadeMigration).text());
    expect(Number((await transaction`SELECT COUNT(*) AS count FROM schema_migrations WHERE name = '0004_cascade_deletions'`)[0].count)).toBe(1);
    await new DeleteCustomer(env.repositories.customers).execute(data.customer.id!);
    const removedOrders = [data.order.id!, data.pendingOrder.id!, data.siblingOrder.id!];
    for (const table of ['order_items', 'status_history', 'quote_decisions']) {
      const [row] = await transaction.unsafe(`SELECT COUNT(*)::int AS count FROM ${table} WHERE work_order_id = ANY($1::int[])`, [removedOrders]);
      expect(row.count).toBe(0);
    }
    expect((await transaction`SELECT COUNT(*)::int AS count FROM order_items WHERE work_order_id = ${data.otherOrder.id!}`)[0].count).toBe(2);
    expect((await transaction`SELECT COUNT(*)::int AS count FROM quote_decisions WHERE work_order_id = ${data.otherOrder.id!}`)[0].count).toBe(1);
    expect((await transaction`SELECT COUNT(*)::int AS count FROM inventory_movements WHERE work_order_id IS NULL`)[0].count).toBe(3);
    expect(await env.eventCount()).toBe(events);
  }, false));

  it('aplica a cascata ao excluir diretamente no banco e preserva catálogo referenciado', () => withPostgresSchema(async (env, transaction) => {
    const data = await seedDeletionFixture(env);
    await expect(transaction.savepoint(savepoint => savepoint`DELETE FROM parts WHERE id = ${data.part.id!}`)).rejects.toMatchObject({ code: '23503' });
    await expect(transaction.savepoint(savepoint => savepoint`DELETE FROM services WHERE id = ${data.service.id!}`)).rejects.toMatchObject({ code: '23503' });
    await transaction`DELETE FROM vehicles WHERE id = ${data.vehicle.id!}`;
    expect(await env.repositories.workOrders.findById(data.order.id!)).toBeUndefined();
    expect(await env.repositories.workOrders.findById(data.pendingOrder.id!)).toBeUndefined();
    expect(await env.repositories.customers.findById(data.customer.id!)).toBeDefined();
    expect(await env.repositories.workOrders.findById(data.siblingOrder.id!)).toBeDefined();
    expect((await env.repositories.parts.movements(data.part.id!)).filter(movement => movement.workOrderId === data.order.id)).toHaveLength(0);
  }));
});

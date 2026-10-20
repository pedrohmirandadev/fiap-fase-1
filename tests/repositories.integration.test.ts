import { afterAll, describe, expect, it } from 'bun:test';
import { createEntityFactories } from './factories';
import { registerRepositoryContract } from './support/repository-contract';
import { createPostgresTestEnvironment } from './support/postgres-environment';
const database = createPostgresTestEnvironment();
afterAll(() => database.close());
describe('Banco real com isolamento por schema', () => {
  registerRepositoryContract('Contratos dos repositórios PostgreSQL', check => database.run(check));

  it('reverte os dados e o schema entre dois cenários independentes', async () => {
    let previousSchema = '';
    await database.run(async (env, transaction) => {
      previousSchema = (await transaction`SELECT current_schema() AS name`)[0].name;
      const customer = await env.repositories.customers.save(createEntityFactories().customer({ id: undefined }));
      expect((await env.repositories.customers.findById(customer.id!))?.id).toBe(customer.id!);
    });
    await database.run(async (env, transaction) => {
      expect(await env.repositories.customers.findAll(10, 0)).toEqual([]);
      expect(await transaction`SELECT schema_name FROM information_schema.schemata WHERE schema_name = ${previousSchema}`).toHaveLength(0);
    });
  });
});

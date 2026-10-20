import { afterAll, describe } from 'bun:test';
import { registerRepositoryContract } from './support/repository-contract';
import { createPostgresTestEnvironment } from './support/postgres-environment';
const database = createPostgresTestEnvironment();
afterAll(() => database.close());
describe('Banco real com isolamento por schema', () => {
  registerRepositoryContract('Contratos dos repositórios PostgreSQL', check => database.run(check));
});

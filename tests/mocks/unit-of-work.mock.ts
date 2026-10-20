import type { RepositoryContext, UnitOfWork } from '../../src/application/unit-of-work';
import { createMockScope, type MockScope, type MockedPort } from './mock-scope';

/** Executa o callback usando os mesmos mocks; não simula persistência ou rollback. */
export function createUnitOfWorkMock(
  repositories: RepositoryContext,
  scope: MockScope = createMockScope()
): MockedPort<UnitOfWork> {
  const run: UnitOfWork['run'] = async operation => operation(repositories);
  return { run: scope.method<UnitOfWork['run']>('UnitOfWork.run', run) };
}

import { createEntityFactories, createRelatedFixtures } from '../factories';
import { createMockScope } from './mock-scope';
import { createRepositoryMocks, createWorkOrderQueriesMock } from './generated';
import { createUnitOfWorkMock } from './unit-of-work.mock';

/** Todos os módulos e dados de exemplo são novos a cada chamada. */
export function createMockEnvironment() {
  const scope = createMockScope();
  const repositories = createRepositoryMocks(scope);
  const factories = createEntityFactories();
  return {
    repositories,
    unitOfWork: createUnitOfWorkMock(repositories, scope),
    workOrderQueries: createWorkOrderQueriesMock(scope),
    factories,
    fixtures: createRelatedFixtures(factories),
    clearMocks: scope.clearMocks,
    resetMocks: scope.resetMocks
  };
}

export type MockEnvironment = ReturnType<typeof createMockEnvironment>;

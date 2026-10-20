// Gerado por bun run mocks:generate. Não edite manualmente.
import type { WorkshopRepository } from '../../../src/domain/workshop/workshop-repository';
import { createMockScope, type MockScope, type MockedPort } from '../mock-scope';

export function createWorkshopRepositoryMock(scope: MockScope = createMockScope()): MockedPort<WorkshopRepository> {
  return {
    findById: scope.method<WorkshopRepository['findById']>('WorkshopRepository.findById'),
    save: scope.method<WorkshopRepository['save']>('WorkshopRepository.save')
  };
}

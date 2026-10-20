// Gerado por bun run mocks:generate. Não edite manualmente.
import type { ServiceRepository } from '../../../src/domain/service/service-repository';
import { createMockScope, type MockScope, type MockedPort } from '../mock-scope';

export function createServiceRepositoryMock(scope: MockScope = createMockScope()): MockedPort<ServiceRepository> {
  return {
    findById: scope.method<ServiceRepository['findById']>('ServiceRepository.findById'),
    findAll: scope.method<ServiceRepository['findAll']>('ServiceRepository.findAll'),
    save: scope.method<ServiceRepository['save']>('ServiceRepository.save')
  };
}

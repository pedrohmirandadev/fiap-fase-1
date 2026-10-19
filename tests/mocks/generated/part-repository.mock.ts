// Gerado por bun run mocks:generate. Não edite manualmente.
import type { PartRepository } from '../../../src/domain/part/part-repository';
import { createMockScope, type MockScope, type MockedPort } from '../mock-scope';

export function createPartRepositoryMock(scope: MockScope = createMockScope()): MockedPort<PartRepository> {
  return {
    findById: scope.method<PartRepository['findById']>('PartRepository.findById'),
    findAll: scope.method<PartRepository['findAll']>('PartRepository.findAll'),
    save: scope.method<PartRepository['save']>('PartRepository.save'),
    recordMovement: scope.method<PartRepository['recordMovement']>('PartRepository.recordMovement'),
    movements: scope.method<PartRepository['movements']>('PartRepository.movements')
  };
}

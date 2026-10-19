// Gerado por bun run mocks:generate. Não edite manualmente.
import type { VehicleRepository } from '../../../src/domain/vehicle/vehicle-repository';
import { createMockScope, type MockScope, type MockedPort } from '../mock-scope';

export function createVehicleRepositoryMock(scope: MockScope = createMockScope()): MockedPort<VehicleRepository> {
  return {
    findById: scope.method<VehicleRepository['findById']>('VehicleRepository.findById'),
    findAll: scope.method<VehicleRepository['findAll']>('VehicleRepository.findAll'),
    save: scope.method<VehicleRepository['save']>('VehicleRepository.save'),
    delete: scope.method<VehicleRepository['delete']>('VehicleRepository.delete')
  };
}

// Gerado por bun run mocks:generate. Não edite manualmente.
import type { WorkOrderRepository } from '../../../src/domain/work-order/work-order-repository';
import { createMockScope, type MockScope, type MockedPort } from '../mock-scope';

export function createWorkOrderRepositoryMock(scope: MockScope = createMockScope()): MockedPort<WorkOrderRepository> {
  return {
    findById: scope.method<WorkOrderRepository['findById']>('WorkOrderRepository.findById'),
    findByTrackingCode: scope.method<WorkOrderRepository['findByTrackingCode']>('WorkOrderRepository.findByTrackingCode'),
    save: scope.method<WorkOrderRepository['save']>('WorkOrderRepository.save')
  };
}

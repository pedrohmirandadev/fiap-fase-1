// Gerado por bun run mocks:generate. Não edite manualmente.
import type { WorkOrderQueries } from '../../../src/application/work-order-queries';
import { createMockScope, type MockScope, type MockedPort } from '../mock-scope';

export function createWorkOrderQueriesMock(scope: MockScope = createMockScope()): MockedPort<WorkOrderQueries> {
  return {
    list: scope.method<WorkOrderQueries['list']>('WorkOrderQueries.list'),
    detail: scope.method<WorkOrderQueries['detail']>('WorkOrderQueries.detail'),
    publicView: scope.method<WorkOrderQueries['publicView']>('WorkOrderQueries.publicView'),
    history: scope.method<WorkOrderQueries['history']>('WorkOrderQueries.history'),
    averageExecutionMinutes: scope.method<WorkOrderQueries['averageExecutionMinutes']>('WorkOrderQueries.averageExecutionMinutes')
  };
}

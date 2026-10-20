// Gerado por bun run mocks:generate. Não edite manualmente.
import type { RepositoryContext } from '../../../src/application/unit-of-work';
import { createMockScope, type MockScope, type MockedPort } from '../mock-scope';
import { createCustomerRepositoryMock } from './customer-repository.mock';
import { createVehicleRepositoryMock } from './vehicle-repository.mock';
import { createServiceRepositoryMock } from './service-repository.mock';
import { createPartRepositoryMock } from './part-repository.mock';
import { createWorkOrderRepositoryMock } from './work-order-repository.mock';
import { createWorkshopRepositoryMock } from './workshop-repository.mock';
import { createAdminUserRepositoryMock } from './admin-user-repository.mock';
import { createDomainEventStoreMock } from './domain-event-store.mock';

export type RepositoryMocks = { [K in keyof RepositoryContext]: MockedPort<RepositoryContext[K]> };

export function createRepositoryMocks(scope: MockScope = createMockScope()): RepositoryMocks {
  return {
    customers: createCustomerRepositoryMock(scope),
    vehicles: createVehicleRepositoryMock(scope),
    services: createServiceRepositoryMock(scope),
    parts: createPartRepositoryMock(scope),
    workOrders: createWorkOrderRepositoryMock(scope),
    workshops: createWorkshopRepositoryMock(scope),
    users: createAdminUserRepositoryMock(scope),
    events: createDomainEventStoreMock(scope)
  };
}

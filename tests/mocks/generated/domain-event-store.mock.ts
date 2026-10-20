// Gerado por bun run mocks:generate. Não edite manualmente.
import type { DomainEventStore } from '../../../src/application/domain-event-store';
import { createMockScope, type MockScope, type MockedPort } from '../mock-scope';

export function createDomainEventStoreMock(scope: MockScope = createMockScope()): MockedPort<DomainEventStore> {
  return {
    append: scope.method<DomainEventStore['append']>('DomainEventStore.append')
  };
}

// Gerado por bun run mocks:generate. Não edite manualmente.
import type { AdminUserRepository } from '../../../src/domain/identity/admin-user-repository';
import { createMockScope, type MockScope, type MockedPort } from '../mock-scope';

export function createAdminUserRepositoryMock(scope: MockScope = createMockScope()): MockedPort<AdminUserRepository> {
  return {
    findByEmail: scope.method<AdminUserRepository['findByEmail']>('AdminUserRepository.findByEmail')
  };
}

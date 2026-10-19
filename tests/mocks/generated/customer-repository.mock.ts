// Gerado por bun run mocks:generate. Não edite manualmente.
import type { CustomerRepository } from '../../../src/domain/customer/customer-repository';
import { createMockScope, type MockScope, type MockedPort } from '../mock-scope';

export function createCustomerRepositoryMock(scope: MockScope = createMockScope()): MockedPort<CustomerRepository> {
  return {
    findById: scope.method<CustomerRepository['findById']>('CustomerRepository.findById'),
    findByDocument: scope.method<CustomerRepository['findByDocument']>('CustomerRepository.findByDocument'),
    findAll: scope.method<CustomerRepository['findAll']>('CustomerRepository.findAll'),
    save: scope.method<CustomerRepository['save']>('CustomerRepository.save'),
    delete: scope.method<CustomerRepository['delete']>('CustomerRepository.delete')
  };
}

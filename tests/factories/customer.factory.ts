import { Customer } from '../../src/domain/customer/customer';
import { TaxDocument } from '../../src/domain/shared/value-objects';
import type { FactoryContext } from './factory-context';

type CustomerProps = Parameters<typeof Customer.create>[0] & { id: number | undefined };

export function createCustomerFactory(context: FactoryContext) {
  return (overrides: Partial<CustomerProps> = {}): Customer => {
    const sequence = context.nextId('customer');
    const props = { id: sequence, name: `Cliente de teste ${sequence}`, document: context.cpf(sequence),
      email: `cliente${sequence}@example.test`, phone: '+5511999990000', ...overrides };
    return new Customer(props.id, props.name, new TaxDocument(props.document), props.email, props.phone);
  };
}

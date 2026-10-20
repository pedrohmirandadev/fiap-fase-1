import { Workshop } from '../../src/domain/workshop/workshop';
import { TaxDocument } from '../../src/domain/shared/value-objects';
import type { FactoryContext } from './factory-context';

type WorkshopProps = Parameters<typeof Workshop.create>[0] & { id: number | undefined };

export function createWorkshopFactory(context: FactoryContext) {
  return (overrides: Partial<WorkshopProps> = {}): Workshop => {
    const sequence = context.nextId('workshop');
    const props = { id: sequence, name: `Oficina de teste ${sequence}`, document: context.cnpj(sequence),
      address: 'Rua de Teste, 100', phone: '+551133330000', ...overrides };
    return new Workshop(props.id, props.name, new TaxDocument(props.document), props.address, props.phone);
  };
}

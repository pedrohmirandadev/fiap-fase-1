import { Part } from '../../src/domain/part/part';
import { Money } from '../../src/domain/shared/value-objects';
import type { FactoryContext } from './factory-context';

type PartProps = Parameters<typeof Part.create>[0] & { id: number | undefined; active: boolean; version: number };

export function createPartFactory(context: FactoryContext) {
  return (overrides: Partial<PartProps> = {}): Part => {
    const sequence = context.nextId('part');
    const props = { id: sequence, sku: `PECA-TESTE-${sequence}`, name: `Filtro ${sequence}`, description: 'Peça fictícia',
      priceCents: 3500, stockQuantity: 10, minimumStock: 2, active: true, version: 0, ...overrides };
    return new Part(props.id, props.sku, props.name, props.description, new Money(props.priceCents),
      props.stockQuantity, props.minimumStock, props.active, props.version);
  };
}

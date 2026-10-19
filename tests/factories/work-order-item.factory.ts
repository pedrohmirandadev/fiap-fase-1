import { WorkOrderItem, ItemKind } from '../../src/domain/work-order/work-order-item';
import { Money, Quantity } from '../../src/domain/shared/value-objects';
import type { FactoryContext } from './factory-context';

type ItemProps = { id: number | undefined; kind: ItemKind; catalogId: number; description: string;
  quantity: number; unitPriceCents: number; consumed: boolean };

export function createWorkOrderItemFactory(context: FactoryContext) {
  return (overrides: Partial<ItemProps> = {}): WorkOrderItem => {
    const props = { id: context.nextId('workOrderItem'), kind: ItemKind.Service, catalogId: 1,
      description: 'Revisão', quantity: 1, unitPriceCents: 18000, consumed: false, ...overrides };
    return new WorkOrderItem(props.id, props.kind, props.catalogId, props.description,
      new Quantity(props.quantity), new Money(props.unitPriceCents), props.consumed);
  };
}

import { InventoryMovement } from '../../src/domain/part/inventory-movement';
import type { FactoryContext } from './factory-context';

type MovementProps = Pick<InventoryMovement, 'id' | 'partId' | 'quantityDelta' | 'reason' | 'workOrderId' | 'createdAt'>;

export function createInventoryMovementFactory(context: FactoryContext) {
  return (overrides: Partial<MovementProps> = {}): InventoryMovement => {
    const props = { id: context.nextId('inventoryMovement'), partId: 1, quantityDelta: 10,
      reason: 'Entrada fictícia', workOrderId: undefined, createdAt: context.date(), ...overrides };
    return new InventoryMovement(props.id, props.partId, props.quantityDelta, props.reason, props.workOrderId, props.createdAt);
  };
}

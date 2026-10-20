import { InventoryMovement } from '../../domain/part/inventory-movement';
import type { MemoryState } from './state';

/** Equivalente às FKs de work_orders: filhos são removidos, estoque perde só o vínculo. */
export function cascadeDeleteWorkOrder(state: MemoryState, id: number): void {
  if (!state.workOrders.delete(id)) return;
  state.movements = state.movements.map(movement => movement.workOrderId === id
    ? new InventoryMovement(movement.id, movement.partId, movement.quantityDelta,
      movement.reason, undefined, movement.createdAt)
    : movement);
}

export function cascadeDeleteVehicle(state: MemoryState, id: number): boolean {
  if (!state.vehicles.has(id)) return false;
  for (const [orderId, record] of state.workOrders) {
    if (record.order.vehicleId === id) cascadeDeleteWorkOrder(state, orderId);
  }
  return state.vehicles.delete(id);
}

import { WorkOrderStatus } from '../../domain/work-order/status';
import { ApplicationError, ErrorKind } from '../../application/errors';
import { WorkOrder } from '../../domain/work-order/work-order';
import { WorkOrderItem, ItemKind } from '../../domain/work-order/work-order-item';
import { QuoteDecision } from '../../domain/work-order/quote-decision';
import { StatusChange } from '../../domain/work-order/status-change';
import type { WorkOrderRepository } from '../../domain/work-order/work-order-repository';
import { nextId, type StateSession } from './state';

export class InMemoryWorkOrderRepository implements WorkOrderRepository {
  constructor(private readonly session: StateSession) {}
  async findById(id: number, _lock = false) { return this.session.state.workOrders.get(id)?.order; }
  async findByTrackingCode(code: string, _lock = false) {
    return [...this.session.state.workOrders.values()].find(record => record.order.trackingCode.value === code)?.order;
  }
  async save(order: WorkOrder): Promise<WorkOrder> {
    const state = this.session.state;
    const vehicle = state.vehicles.get(order.vehicleId);
    if (!state.customers.has(order.customerId) || !vehicle || !vehicle.belongsTo(order.customerId)) {
      throw new ApplicationError(ErrorKind.Conflict, 'Cliente ou veículo inválido');
    }
    if ([...state.workOrders.values()].some(record => record.order.id !== order.id && record.order.trackingCode.equals(order.trackingCode))) {
      throw new ApplicationError(ErrorKind.Conflict, 'Código de acompanhamento duplicado');
    }
    for (const item of order.items) {
      if (!(item.kind === ItemKind.Service ? state.services : state.parts).has(item.catalogId)) {
        throw new ApplicationError(ErrorKind.Conflict, 'Item de catálogo não encontrado');
      }
    }
    const id = order.id ?? nextId(state, 'workOrder');
    const items = order.items.map(item => new WorkOrderItem(item.id ?? nextId(state, 'workOrderItem'),
      item.kind, item.catalogId, item.description, item.quantity, item.unitPrice, item.consumed));
    const decisions = order.decisions.map((decision, index) => new QuoteDecision(decision.approved, decision.total,
      decision.reason, decision.createdAt, decision.quoteVersion, decision.id ?? index + 1));
    const history = order.history.map((change, index) => new StatusChange(change.from, change.to, change.note, change.createdAt, change.id ?? index + 1));
    const persisted = new WorkOrder(id, order.customerId, order.vehicleId, order.complaint, order.trackingCode,
      order.status, items, decisions, history, order.quoteVersion);
    state.workOrders.set(id, {
      order: persisted, quoteTotalCents: order.quote.cents,
      openedAt: state.workOrders.get(id)?.openedAt ?? order.history[0]?.createdAt ?? new Date(), updatedAt: new Date(),
      startedAt: history.find(change => change.to === WorkOrderStatus.InProgress)?.createdAt,
      finishedAt: history.find(change => change.to === WorkOrderStatus.Finished)?.createdAt,
      deliveredAt: history.find(change => change.to === WorkOrderStatus.Delivered)?.createdAt
    });
    return persisted;
  }
}

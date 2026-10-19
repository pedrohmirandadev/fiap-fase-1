import type { WorkOrderQueries } from '../../application/work-order-queries';
import { type WorkOrderItem, ItemKind } from '../../domain/work-order/work-order-item';
import type { WorkOrderStatus } from '../../domain/work-order/status';
import type { StatusChange } from '../../domain/work-order/status-change';
import type { StoredWorkOrder, StateSession } from './state';

const itemRow = (item: WorkOrderItem) => ({
  id: item.id, kind: item.kind, service_id: item.kind === ItemKind.Service ? item.catalogId : null,
  part_id: item.kind === ItemKind.Part ? item.catalogId : null, description: item.description,
  quantity: item.quantity.value, unit_price_cents: item.unitPrice.cents, consumed: item.consumed
});
const historyRow = (change: StatusChange) => ({
  from_status: change.from, to_status: change.to, note: change.note ?? null, created_at: change.createdAt
});

export class InMemoryWorkOrderQueries implements WorkOrderQueries {
  constructor(private readonly session: StateSession) {}

  private base(record: StoredWorkOrder) {
    const order = record.order;
    return {
      id: order.id, tracking_code: order.trackingCode.value, customer_id: order.customerId,
      vehicle_id: order.vehicleId, complaint: order.complaint, status: order.status,
      quote_total_cents: record.quoteTotalCents, quote_version: order.quoteVersion.value, opened_at: record.openedAt,
      started_at: record.startedAt ?? null, finished_at: record.finishedAt ?? null,
      delivered_at: record.deliveredAt ?? null, updated_at: record.updatedAt
    };
  }

  async list(status?: WorkOrderStatus, limit = 50, offset = 0) {
    return [...this.session.state.workOrders.values()]
      .filter(record => !status || record.order.status === status)
      .sort((a, b) => b.order.id! - a.order.id!).slice(offset, offset + limit)
      .map(record => {
        const customer = this.session.state.customers.get(record.order.customerId)!;
        const vehicle = this.session.state.vehicles.get(record.order.vehicleId)!;
        return { ...this.base(record), customer_name: customer.name, plate: vehicle.plate.value, brand: vehicle.brand, model: vehicle.model };
      });
  }

  async detail(id: number) {
    const record = this.session.state.workOrders.get(id);
    if (!record) return undefined;
    const customer = this.session.state.customers.get(record.order.customerId)!;
    const vehicle = this.session.state.vehicles.get(record.order.vehicleId)!;
    return {
      ...this.base(record), customer_name: customer.name, document: customer.document.value,
      plate: vehicle.plate.value, brand: vehicle.brand, model: vehicle.model, year: vehicle.year,
      items: record.order.items.map(itemRow), history: record.order.history.map(historyRow),
      decisions: record.order.decisions.map(decision => ({
        approved: decision.approved, reason: decision.reason ?? null,
        quote_total_cents: decision.total.cents, quote_version: decision.quoteVersion.value, created_at: decision.createdAt
      }))
    };
  }

  async publicView(trackingCode: string) {
    const record = [...this.session.state.workOrders.values()]
      .find(current => current.order.trackingCode.value === trackingCode);
    if (!record) return undefined;
    const order = record.order;
    const vehicle = this.session.state.vehicles.get(order.vehicleId)!;
    return {
      trackingCode: order.trackingCode.value, status: order.status, complaint: order.complaint,
      vehicle: { brand: vehicle.brand, model: vehicle.model, plate: vehicle.plate.value },
      quoteTotalCents: record.quoteTotalCents, quoteVersion: order.quoteVersion.value,
      items: order.items.map(item => ({ kind: item.kind, description: item.description,
        quantity: item.quantity.value, unit_price_cents: item.unitPrice.cents })),
      openedAt: record.openedAt, updatedAt: record.updatedAt
    };
  }

  async history(id: number) { return this.session.state.workOrders.get(id)?.order.history.map(historyRow) ?? []; }

  async averageExecutionMinutes() {
    const completed = [...this.session.state.workOrders.values()]
      .filter(record => record.startedAt && record.finishedAt);
    const average = completed.reduce((sum, record) => sum + (record.finishedAt!.getTime() - record.startedAt!.getTime()) / 60000, 0) / completed.length;
    return { completed_orders: completed.length, average_minutes: completed.length ? average.toFixed(2) : null };
  }
}

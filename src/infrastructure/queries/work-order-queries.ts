import type { WorkOrderQueries } from '../../application/work-order-queries';
import type { WorkOrderStatus } from '../../domain/work-order/status';
import { PostgresDao } from '../database/postgres-dao';

export class PgWorkOrderQueries extends PostgresDao implements WorkOrderQueries {
  list(status?: WorkOrderStatus, limit = 50, offset = 0) {
    return this.rows<Record<string, unknown>>('SELECT w.*, c.name AS customer_name, v.plate, v.brand, v.model FROM work_orders w JOIN customers c ON c.id = w.customer_id JOIN vehicles v ON v.id = w.vehicle_id WHERE ($1::text IS NULL OR w.status::text = $1) ORDER BY w.id DESC LIMIT $2 OFFSET $3', [status ?? null, limit, offset]);
  }
  async detail(id: number) {
    const order = await this.first<Record<string, unknown>>('SELECT w.*, c.name AS customer_name, c.document, v.plate, v.brand, v.model, v.year FROM work_orders w JOIN customers c ON c.id = w.customer_id JOIN vehicles v ON v.id = w.vehicle_id WHERE w.id = $1', [id]);
    if (!order) return undefined;
    const items = await this.rows('SELECT * FROM order_items WHERE work_order_id = $1 ORDER BY id', [id]);
    const history = await this.history(id);
    const decisions = await this.rows('SELECT approved, reason, quote_total_cents, quote_version, created_at FROM quote_decisions WHERE work_order_id = $1 ORDER BY id', [id]);
    return { ...order, items, history, decisions };
  }
  async publicView(code: string) {
    const order = await this.first<Record<string, unknown>>('SELECT w.id, w.tracking_code, w.status, w.complaint, w.quote_total_cents, w.quote_version, w.opened_at, w.updated_at, v.brand, v.model, v.plate FROM work_orders w JOIN vehicles v ON v.id = w.vehicle_id WHERE w.tracking_code = $1', [code]);
    if (!order) return undefined;
    const items = await this.rows('SELECT kind, description, quantity, unit_price_cents FROM order_items WHERE work_order_id = $1 ORDER BY id', [Number(order.id)]);
    return { trackingCode: order.tracking_code, status: order.status, complaint: order.complaint,
      vehicle: { brand: order.brand, model: order.model, plate: order.plate }, quoteTotalCents: order.quote_total_cents, quoteVersion: order.quote_version,
      items, openedAt: order.opened_at, updatedAt: order.updated_at };
  }
  history(id: number) { return this.rows<Record<string, unknown>>('SELECT from_status, to_status, note, created_at FROM status_history WHERE work_order_id = $1 ORDER BY id', [id]); }
  async averageExecutionMinutes() { return (await this.first<{ completed_orders: number; average_minutes: string | null }>('SELECT COUNT(*)::int AS completed_orders, ROUND(AVG(EXTRACT(EPOCH FROM (finished_at - started_at)) / 60)::numeric, 2) AS average_minutes FROM work_orders WHERE started_at IS NOT NULL AND finished_at IS NOT NULL'))!; }
}

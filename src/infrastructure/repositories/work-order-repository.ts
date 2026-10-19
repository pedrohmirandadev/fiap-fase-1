import { WorkOrder } from '../../domain/work-order/work-order';
import { WorkOrderItem, ItemKind } from '../../domain/work-order/work-order-item';
import { QuoteDecision } from '../../domain/work-order/quote-decision';
import { QuoteVersion } from '../../domain/work-order/quote-version';
import { StatusChange } from '../../domain/work-order/status-change';
import type { WorkOrderRepository } from '../../domain/work-order/work-order-repository';
import { WorkOrderStatus } from '../../domain/work-order/status';
import { Money, Quantity, TrackingCode } from '../../domain/shared/value-objects';
import { PostgresDao } from '../database/postgres-dao';

type Row = { id: number; customer_id: number; vehicle_id: number; complaint: string; tracking_code: string; status: WorkOrderStatus; quote_version: number };
type ItemRow = { id: number; kind: ItemKind; service_id: number | null; part_id: number | null; description: string; quantity: number; unit_price_cents: number; consumed: boolean };

export class PgWorkOrderRepository extends PostgresDao implements WorkOrderRepository {
  private async hydrate(row: Row): Promise<WorkOrder> {
    const items = await this.rows<ItemRow>('SELECT * FROM order_items WHERE work_order_id = $1 ORDER BY id', [row.id]);
    const decisions = await this.rows<{ id: number; approved: boolean; quote_total_cents: number; reason: string | null; created_at: Date; quote_version: number }>('SELECT * FROM quote_decisions WHERE work_order_id = $1 ORDER BY id', [row.id]);
    const history = await this.rows<{ id: number; from_status: WorkOrderStatus | null; to_status: WorkOrderStatus; note: string | null; created_at: Date }>('SELECT * FROM status_history WHERE work_order_id = $1 ORDER BY id', [row.id]);
    return new WorkOrder(row.id, row.customer_id, row.vehicle_id, row.complaint, new TrackingCode(row.tracking_code), row.status,
      items.map(item => new WorkOrderItem(item.id, item.kind, item.service_id ?? item.part_id!, item.description, new Quantity(item.quantity), new Money(item.unit_price_cents), item.consumed)),
      decisions.map(decision => new QuoteDecision(decision.approved, new Money(decision.quote_total_cents), decision.reason ?? undefined, decision.created_at, new QuoteVersion(decision.quote_version), decision.id)),
      history.map(change => new StatusChange(change.from_status, change.to_status, change.note ?? undefined, change.created_at, change.id)), new QuoteVersion(row.quote_version));
  }
  async findById(id: number, lock = false) {
    const row = await this.first<Row>(`SELECT * FROM work_orders WHERE id = $1${lock ? ' FOR UPDATE' : ''}`, [id]);
    return row && this.hydrate(row);
  }
  async findByTrackingCode(code: string, lock = false) {
    const row = await this.first<Row>(`SELECT * FROM work_orders WHERE tracking_code = $1${lock ? ' FOR UPDATE' : ''}`, [code]);
    return row && this.hydrate(row);
  }

  /** Chamado dentro de UnitOfWork; todos os filhos são persistidos pela raiz. */
  async save(order: WorkOrder): Promise<WorkOrder> {
    const started = order.history.find(change => change.to === WorkOrderStatus.InProgress)?.createdAt;
    const finished = order.history.find(change => change.to === WorkOrderStatus.Finished)?.createdAt;
    const delivered = order.history.find(change => change.to === WorkOrderStatus.Delivered)?.createdAt;
    const row = order.id === undefined
      ? await this.first<Row>('INSERT INTO work_orders (tracking_code,customer_id,vehicle_id,complaint,status,quote_total_cents,quote_version) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
        [order.trackingCode.value, order.customerId, order.vehicleId, order.complaint, order.status, order.quote.cents, order.quoteVersion.value])
      : await this.first<Row>('UPDATE work_orders SET status=$2, quote_total_cents=$3, quote_version=$4, started_at=$5, finished_at=$6, delivered_at=$7, updated_at=now() WHERE id=$1 RETURNING *',
        [order.id, order.status, order.quote.cents, order.quoteVersion.value, started ?? null, finished ?? null, delivered ?? null]);
    if (!row) throw new Error('OS não encontrada ao persistir agregado');
    for (const item of order.items) {
      if (item.id === undefined) {
        await this.rows('INSERT INTO order_items (work_order_id,kind,service_id,part_id,description,quantity,unit_price_cents,consumed) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
          [row.id, item.kind, item.kind === ItemKind.Service ? item.catalogId : null, item.kind === ItemKind.Part ? item.catalogId : null, item.description, item.quantity.value, item.unitPrice.cents, item.consumed]);
      } else {
        await this.rows('UPDATE order_items SET consumed=$3 WHERE id=$1 AND work_order_id=$2', [item.id, row.id, item.consumed]);
      }
    }
    for (const decision of order.decisions.filter(decision => decision.id === undefined)) {
      await this.rows('INSERT INTO quote_decisions (work_order_id,approved,reason,quote_total_cents,quote_version,created_at) VALUES ($1,$2,$3,$4,$5,$6)',
        [row.id, decision.approved, decision.reason ?? null, decision.total.cents, decision.quoteVersion.value, decision.createdAt]);
    }
    for (const change of order.history.filter(change => change.id === undefined)) {
      await this.rows('INSERT INTO status_history (work_order_id,from_status,to_status,note,created_at) VALUES ($1,$2,$3,$4,$5)',
        [row.id, change.from, change.to, change.note ?? null, change.createdAt]);
    }
    return this.hydrate(row);
  }
}

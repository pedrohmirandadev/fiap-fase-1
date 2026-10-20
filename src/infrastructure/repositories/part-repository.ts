import { ApplicationError, ErrorKind } from '../../application/errors';
import { Part } from '../../domain/part/part';
import type { PartRepository } from '../../domain/part/part-repository';
import { InventoryMovement } from '../../domain/part/inventory-movement';
import { Money } from '../../domain/shared/value-objects';
import { PostgresDao } from '../database/postgres-dao';

type Row = { id: number; sku: string; name: string; description: string | null; price_cents: number; stock_quantity: number; minimum_stock: number; active: boolean; version: number };
const map = (row: Row) => new Part(row.id, row.sku, row.name, row.description ?? undefined, new Money(row.price_cents), row.stock_quantity, row.minimum_stock, row.active, row.version);
export class PgPartRepository extends PostgresDao implements PartRepository {
  async findById(id: number, lock = false) { const row = await this.first<Row>(`SELECT * FROM parts WHERE id = $1${lock ? ' FOR UPDATE' : ''}`, [id]); return row && map(row); }
  async findAll() { return (await this.rows<Row>('SELECT * FROM parts ORDER BY id')).map(map); }
  async save(part: Part) {
    const row = part.id === undefined
      ? await this.first<Row>('INSERT INTO parts (sku, name, description, price_cents, stock_quantity, minimum_stock) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *', [part.sku, part.name, part.description ?? null, part.price.cents, part.stockQuantity, part.minimumStock])
      : await this.first<Row>('UPDATE parts SET name = $2, description = $3, price_cents = $4, minimum_stock = $5, active = $6, stock_quantity = $7, version = version + 1, updated_at = now() WHERE id = $1 AND version = $8 RETURNING *', [part.id, part.name, part.description ?? null, part.price.cents, part.minimumStock, part.active, part.stockQuantity, part.version]);
    if (!row) throw new ApplicationError(ErrorKind.Conflict, 'Peça alterada por outra operação; tente novamente');
    return map(row);
  }
  async recordMovement(movement: InventoryMovement) { await this.rows('INSERT INTO inventory_movements (part_id, work_order_id, quantity_delta, reason, created_at) VALUES ($1, $2, $3, $4, $5)', [movement.partId, movement.workOrderId ?? null, movement.quantityDelta, movement.reason, movement.createdAt]); }
  async movements(id: number) {
    const rows = await this.rows<{ id: number; part_id: number; quantity_delta: number; reason: string; work_order_id: number | null; created_at: Date }>('SELECT * FROM inventory_movements WHERE part_id = $1 ORDER BY id DESC', [id]);
    return rows.map(row => new InventoryMovement(row.id, row.part_id, row.quantity_delta, row.reason, row.work_order_id ?? undefined, row.created_at));
  }
}

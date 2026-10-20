import { Service } from '../../domain/service/service';
import type { ServiceRepository } from '../../domain/service/service-repository';
import { Money } from '../../domain/shared/value-objects';
import { PostgresDao, type SqlConnection } from '../database/postgres-dao';

type Row = { id: number; name: string; description: string | null; price_cents: number; estimated_minutes: number; active: boolean };
const map = (row: Row) => new Service(row.id, row.name, row.description ?? undefined, new Money(row.price_cents), row.estimated_minutes, row.active);
export class PgServiceRepository extends PostgresDao implements ServiceRepository {
  constructor(connection: SqlConnection) { super(connection); }
  async findById(id: number) { const row = await this.first<Row>('SELECT * FROM services WHERE id = $1', [id]); return row && map(row); }
  async findAll() { return (await this.rows<Row>('SELECT * FROM services ORDER BY id')).map(map); }
  async save(service: Service) {
    const row = service.id === undefined
      ? await this.first<Row>('INSERT INTO services (name, description, price_cents, estimated_minutes) VALUES ($1, $2, $3, $4) RETURNING *', [service.name, service.description ?? null, service.price.cents, service.estimatedMinutes])
      : await this.first<Row>('UPDATE services SET name = $2, description = $3, price_cents = $4, estimated_minutes = $5, active = $6, updated_at = now() WHERE id = $1 RETURNING *', [service.id, service.name, service.description ?? null, service.price.cents, service.estimatedMinutes, service.active]);
    return map(row!);
  }
}

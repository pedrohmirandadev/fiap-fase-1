import { Workshop } from '../../domain/workshop/workshop';
import type { WorkshopRepository } from '../../domain/workshop/workshop-repository';
import { TaxDocument } from '../../domain/shared/value-objects';
import { PostgresDao, type SqlConnection } from '../database/postgres-dao';

type Row = { id: number; name: string; document: string; address: string; phone: string | null };
const map = (row: Row) => new Workshop(row.id, row.name, new TaxDocument(row.document), row.address, row.phone ?? undefined);
export class PgWorkshopRepository extends PostgresDao implements WorkshopRepository {
  constructor(connection: SqlConnection) { super(connection); }
  async findById(id: number) { const row = await this.first<Row>('SELECT * FROM workshops WHERE id = $1', [id]); return row && map(row); }
  async save(workshop: Workshop) {
    const row = workshop.id === undefined
      ? await this.first<Row>('INSERT INTO workshops (name, document, address, phone) VALUES ($1, $2, $3, $4) RETURNING *', [workshop.name, workshop.document.value, workshop.address, workshop.phone ?? null])
      : await this.first<Row>('UPDATE workshops SET name = $2, address = $3, phone = $4, updated_at = now() WHERE id = $1 RETURNING *', [workshop.id, workshop.name, workshop.address, workshop.phone ?? null]);
    return map(row!);
  }
}

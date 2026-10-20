import type { DomainEventStore } from '../../application/domain-event-store';
import type { DomainEvent } from '../../domain/shared/domain-event';
import { PostgresDao, type SqlConnection } from './postgres-dao';

export class PgDomainEventStore extends PostgresDao implements DomainEventStore {
  constructor(connection: SqlConnection) { super(connection); }
  async append(events: readonly DomainEvent[]): Promise<void> {
    for (const event of events) {
      // O parâmetro é texto JSON; inferi-lo como jsonb faria o driver serializá-lo novamente.
      await this.rows('INSERT INTO domain_events (id, name, aggregate_type, aggregate_id, occurred_at, payload) VALUES ($1,$2,$3,$4,$5,$6::text::jsonb)',
        [event.id, event.name, event.aggregateType, event.aggregateId, event.occurredAt, JSON.stringify(event.payload)]);
    }
  }
}

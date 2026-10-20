import { PgDomainEventStore } from './domain-event-store';
import { client } from './connection';
import type { SqlConnection } from './postgres-dao';
import type { UnitOfWork, RepositoryContext } from '../../application/unit-of-work';
import { PgCustomerRepository } from '../repositories/customer-repository';
import { PgVehicleRepository } from '../repositories/vehicle-repository';
import { PgServiceRepository } from '../repositories/service-repository';
import { PgPartRepository } from '../repositories/part-repository';
import { PgWorkOrderRepository } from '../repositories/work-order-repository';
import { PgWorkshopRepository } from '../repositories/workshop-repository';
import { PgAdminUserRepository } from '../repositories/admin-user-repository';

export function repositoryContext(sql: SqlConnection): RepositoryContext {
  return {
    customers: new PgCustomerRepository(sql), vehicles: new PgVehicleRepository(sql),
    services: new PgServiceRepository(sql), parts: new PgPartRepository(sql),
    workOrders: new PgWorkOrderRepository(sql), workshops: new PgWorkshopRepository(sql),
    users: new PgAdminUserRepository(sql), events: new PgDomainEventStore(sql)
  };
}

export class PgUnitOfWork implements UnitOfWork {
  constructor(private readonly connection: SqlConnection = client) {}
  async run<T>(operation: (context: RepositoryContext) => Promise<T>): Promise<T> {
    if ('savepoint' in this.connection) {
      return await this.connection.savepoint(async transaction => operation(repositoryContext(transaction))) as T;
    }
    return await this.connection.begin(async transaction => operation(repositoryContext(transaction))) as T;
  }
}

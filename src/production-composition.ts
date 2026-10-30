import { createUseCases } from './composition';
import { client } from './infrastructure/database/connection';
import { PgUnitOfWork, repositoryContext } from './infrastructure/database/pg-unit-of-work';
import { PgWorkOrderQueries } from './infrastructure/queries/work-order-queries';

export const useCases = createUseCases(repositoryContext(client), new PgUnitOfWork(), new PgWorkOrderQueries(client));

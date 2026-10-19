import type { WorkOrderStatus } from '../../../domain/work-order/status';
import type { WorkOrderQueries } from '../../work-order-queries';
export class ListWorkOrders {
  constructor(private readonly queries: WorkOrderQueries) {}
  execute(status?: WorkOrderStatus, limit?: string, offset?: string) {
    return this.queries.list(status, Math.min(100, Math.max(1, Number(limit) || 50)), Math.max(0, Number(offset) || 0));
  }
}

import { WorkOrder } from '../../src/domain/work-order/work-order';
import { WorkOrderStatus } from '../../src/domain/work-order/status';
import { TrackingCode } from '../../src/domain/shared/value-objects';
import { QuoteVersion } from '../../src/domain/work-order/quote-version';
import type { FactoryContext } from './factory-context';
import type { createWorkOrderItemFactory } from './work-order-item.factory';
import type { createStatusChangeFactory } from './status-change.factory';

type WorkOrderProps = Pick<WorkOrder, 'id' | 'customerId' | 'vehicleId' | 'complaint' | 'trackingCode' | 'items' | 'quoteVersion'>;

export function createWorkOrderFactory(context: FactoryContext,
  item: ReturnType<typeof createWorkOrderItemFactory>, statusChange: ReturnType<typeof createStatusChangeFactory>) {
  return (overrides: Partial<WorkOrderProps> = {}): WorkOrder => {
    const sequence = context.nextId('workOrder');
    const props = { id: sequence, customerId: 1, vehicleId: 1, complaint: 'Revisão preventiva',
      trackingCode: new TrackingCode(String(sequence).padStart(32, '0')), quoteVersion: new QuoteVersion(), ...overrides };
    return new WorkOrder(props.id, props.customerId, props.vehicleId, props.complaint, props.trackingCode,
      WorkOrderStatus.Received, overrides.items ?? [item()], [], [statusChange()], props.quoteVersion);
  };
}

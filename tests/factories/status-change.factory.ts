import { StatusChange } from '../../src/domain/work-order/status-change';
import { WorkOrderStatus } from '../../src/domain/work-order/status';
import type { FactoryContext } from './factory-context';

type StatusChangeProps = Pick<StatusChange, 'id' | 'from' | 'to' | 'note' | 'createdAt'>;

export function createStatusChangeFactory(context: FactoryContext) {
  return (overrides: Partial<StatusChangeProps> = {}): StatusChange => {
    const props = { id: context.nextId('statusChange'), from: null, to: WorkOrderStatus.Received,
      note: 'OS criada', createdAt: context.date(), ...overrides };
    return new StatusChange(props.from, props.to, props.note, props.createdAt, props.id);
  };
}

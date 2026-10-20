import type { RepositoryContext } from './unit-of-work';
import { WorkOrderItem, ItemKind } from '../domain/work-order/work-order-item';
import { Money, Quantity } from '../domain/shared/value-objects';
import { ApplicationError, ErrorKind } from './errors';

export interface OrderItemRequest { type: ItemKind; id: number; quantity: number }
export async function resolveOrderItem(context: RepositoryContext, request: OrderItemRequest): Promise<WorkOrderItem> {
  const quantity = new Quantity(request.quantity);
  if (request.type === ItemKind.Service) {
    const service = await context.services.findById(request.id);
    if (!service?.active) throw new ApplicationError(ErrorKind.Validation, 'Serviço não encontrado/ativo');
    return new WorkOrderItem(undefined, ItemKind.Service, request.id, service.name, quantity, new Money(service.price.cents));
  }
  const part = await context.parts.findById(request.id);
  if (!part?.active) throw new ApplicationError(ErrorKind.Validation, 'Peça não encontrada/ativa');
  part.ensureAvailable(quantity.value);
  return new WorkOrderItem(undefined, ItemKind.Part, request.id, part.name, quantity, new Money(part.price.cents));
}

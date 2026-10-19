import { ItemKind } from '../../../domain/work-order/work-order-item';
import { WorkOrder } from '../../../domain/work-order/work-order';
import { TaxDocument } from '../../../domain/shared/value-objects';
import type { UnitOfWork } from '../../unit-of-work';
import { resolveOrderItem, type OrderItemRequest } from '../../resolve-order-item';
import { ApplicationError, ErrorKind } from '../../errors';
import { requireFound } from '../../require-found';

export interface CreateWorkOrderCommand { customerId?: number; customerDocument?: string; vehicleId: number; complaint: string; items: OrderItemRequest[] }

export class CreateWorkOrder {
  constructor(private readonly unitOfWork: UnitOfWork) {}
  execute(input: CreateWorkOrderCommand) {
    if (!input.items.length) throw new ApplicationError(ErrorKind.Validation, 'A OS deve conter ao menos um serviço ou peça');
    return this.unitOfWork.run(async context => {
      const byDocument = input.customerDocument ? await context.customers.findByDocument(new TaxDocument(input.customerDocument).value) : undefined;
      const customerId = input.customerId ?? byDocument?.id;
      if (!customerId) throw new ApplicationError(ErrorKind.Validation, 'Informe cliente cadastrado por ID ou CPF/CNPJ válido');
      if (input.customerId && input.customerDocument && byDocument?.id !== input.customerId) throw new ApplicationError(ErrorKind.Validation, 'CPF/CNPJ não corresponde ao cliente informado');
      requireFound(await context.customers.findById(customerId), 'Cliente');
      const vehicle = requireFound(await context.vehicles.findById(input.vehicleId), 'Veículo');
      if (!vehicle.belongsTo(customerId)) throw new ApplicationError(ErrorKind.Validation, 'Veículo não pertence ao cliente informado');
      const items = [];
      for (const request of input.items) items.push(await resolveOrderItem(context, request));
      const requestedParts = new Map<number, number>();
      for (const item of items.filter(item => item.kind === ItemKind.Part)) {
        requestedParts.set(item.catalogId, (requestedParts.get(item.catalogId) ?? 0) + item.quantity.value);
      }
      for (const [partId, quantity] of requestedParts) {
        (await context.parts.findById(partId))!.ensureAvailable(quantity);
      }
      const aggregate = WorkOrder.create(customerId, input.vehicleId, input.complaint, items);
      const order = await context.workOrders.save(aggregate);
      await context.events.append(aggregate.pendingEvents);
      return { id: order.id, trackingCode: order.trackingCode.value, quote_total_cents: order.quote.cents, status: order.status, quoteVersion: order.quoteVersion.value };
    });
  }
}

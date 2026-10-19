import { ItemKind } from '../../src/domain/work-order/work-order-item';
import { createFactoryContext } from './factory-context';
import { createCustomerFactory } from './customer.factory';
import { createVehicleFactory } from './vehicle.factory';
import { createServiceFactory } from './service.factory';
import { createPartFactory } from './part.factory';
import { createWorkshopFactory } from './workshop.factory';
import { createAdminUserFactory } from './admin-user.factory';
import { createWorkOrderItemFactory } from './work-order-item.factory';
import { createQuoteDecisionFactory } from './quote-decision.factory';
import { createStatusChangeFactory } from './status-change.factory';
import { createInventoryMovementFactory } from './inventory-movement.factory';
import { createWorkOrderFactory } from './work-order.factory';

export { FIXTURE_ADMIN_PASSWORD } from './admin-user.factory';

export function createEntityFactories() {
  const context = createFactoryContext();
  const workOrderItem = createWorkOrderItemFactory(context);
  const statusChange = createStatusChangeFactory(context);
  return {
    customer: createCustomerFactory(context), vehicle: createVehicleFactory(context),
    service: createServiceFactory(context), part: createPartFactory(context),
    workshop: createWorkshopFactory(context), adminUser: createAdminUserFactory(context),
    workOrderItem, quoteDecision: createQuoteDecisionFactory(context), statusChange,
    inventoryMovement: createInventoryMovementFactory(context),
    workOrder: createWorkOrderFactory(context, workOrderItem, statusChange)
  };
}

export type EntityFactories = ReturnType<typeof createEntityFactories>;

/** Constrói um conjunto relacionado; as fábricas continuam disponíveis para outros cenários. */
export function createRelatedFixtures(factories: EntityFactories = createEntityFactories()) {
  const customer = factories.customer();
  const vehicle = factories.vehicle({ customerId: customer.id! });
  const service = factories.service();
  const part = factories.part();
  const serviceItem = factories.workOrderItem({ kind: ItemKind.Service, catalogId: service.id!,
    description: service.name, unitPriceCents: service.price.cents });
  const partItem = factories.workOrderItem({ kind: ItemKind.Part, catalogId: part.id!,
    description: part.name, unitPriceCents: part.price.cents });
  const workOrder = factories.workOrder({ customerId: customer.id!, vehicleId: vehicle.id!, items: [serviceItem, partItem] });
  return {
    customer, vehicle, service, part, workOrder, serviceItem, partItem,
    workshop: factories.workshop(), adminUser: factories.adminUser(),
    quoteDecision: factories.quoteDecision({ totalCents: workOrder.quote.cents, quoteVersion: workOrder.quoteVersion.value }),
    statusChange: workOrder.history[0]!, inventoryMovement: factories.inventoryMovement({ partId: part.id! })
  };
}

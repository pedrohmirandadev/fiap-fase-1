import { DomainErrorKind } from '../src/domain/shared/domain-error';
import { DomainEventName } from '../src/domain/shared/domain-event';
import { ItemKind } from '../src/domain/work-order/work-order-item';
import { WorkOrderStatus } from '../src/domain/work-order/status';
import { describe, expect, it } from 'bun:test';
import { hashSync } from 'bcryptjs';
import { createInMemoryEnvironment } from '../src/infrastructure/in-memory/context';
import { AdminUser } from '../src/domain/identity/admin-user';
import { AuthenticateAdmin } from '../src/application/use-cases/authenticate-admin';
import { CreateCustomer } from '../src/application/use-cases/customer/create-customer';
import { UpdateCustomer } from '../src/application/use-cases/customer/update-customer';
import { CreateVehicle } from '../src/application/use-cases/vehicle/create-vehicle';
import { UpdateVehicle } from '../src/application/use-cases/vehicle/update-vehicle';
import { CreateService } from '../src/application/use-cases/service/create-service';
import { UpdateService } from '../src/application/use-cases/service/update-service';
import { CreatePart } from '../src/application/use-cases/part/create-part';
import { UpdatePart } from '../src/application/use-cases/part/update-part';
import { AdjustStock } from '../src/application/use-cases/part/adjust-stock';
import { CreateWorkshop } from '../src/application/use-cases/workshop/create-workshop';
import { GetWorkshop } from '../src/application/use-cases/workshop/get-workshop';
import { CreateWorkOrder } from '../src/application/use-cases/work-order/create-work-order';
import { ChangeWorkOrderStatus } from '../src/application/use-cases/work-order/change-work-order-status';
import { DecideQuote } from '../src/application/use-cases/work-order/decide-quote';
import { ProposeAdditionalRepair } from '../src/application/use-cases/work-order/propose-additional-repair';
import { TrackWorkOrder } from '../src/application/use-cases/work-order/track-work-order';
import { GetWorkOrder } from '../src/application/use-cases/work-order/get-work-order';
import { GetAverageExecutionTime } from '../src/application/use-cases/work-order/get-average-execution-time';
import { registerCascadeDeletionTests } from './support/cascade-deletion-contract';

describe('adaptadores in-memory', () => {
  it('executa casos de uso de cadastro, alterações explícitas e autenticação sem PostgreSQL', async () => {
    const { store, repositories } = createInMemoryEnvironment();
    const customer = await new CreateCustomer(repositories.customers).execute({ name: 'Marina Souza', document: '52998224725' });
    const updatedCustomer = await new UpdateCustomer(repositories.customers).execute(customer.id!, { name: 'Marina Oliveira', phone: '11999990000' });
    expect(updatedCustomer.name).toBe('Marina Oliveira');
    expect(updatedCustomer.phone).toBe('11999990000');
    expect(await repositories.customers.findByDocument(customer.document.value)).toEqual(updatedCustomer);

    const vehicle = await new CreateVehicle(repositories.vehicles, repositories.customers).execute({ customerId: customer.id!, plate: 'ABC1D23', brand: 'Honda', model: 'Civic', year: 2022 });
    expect((await new UpdateVehicle(repositories.vehicles).execute(vehicle.id!, { year: 2023 })).year).toBe(2023);
    const service = await new CreateService(repositories.services).execute({ name: 'Revisão', priceCents: 10000, estimatedMinutes: 60 });
    expect((await new UpdateService(repositories.services).execute(service.id!, { priceCents: 12000 })).price.cents).toBe(12000);
    const part = await new CreatePart(repositories.parts).execute({ sku: 'FILTRO-1', name: 'Filtro', priceCents: 3500, stockQuantity: 2 });
    expect((await new UpdatePart(repositories.parts).execute(part.id!, { minimumStock: 1 })).minimumStock).toBe(1);

    const workshop = await new CreateWorkshop(repositories.workshops).execute({ name: 'Oficina Exemplo', document: '11222333000181', address: 'Rua Exemplo, 10' });
    expect((await new GetWorkshop(repositories.workshops).execute(workshop.id!)).name).toBe('Oficina Exemplo');
    store.addAdminUser(new AdminUser(1, 'admin@example.test', hashSync('Senha123!', 4)));
    expect(await new AuthenticateAdmin(repositories.users).execute('admin@example.test', 'Senha123!')).toEqual({ sub: '1', email: 'admin@example.test' });
  });

  it('reverte aprovação incompleta e conclui o fluxo após reposição de estoque', async () => {
    const { store, repositories, unitOfWork, workOrderQueries } = createInMemoryEnvironment();
    const customer = await new CreateCustomer(repositories.customers).execute({ name: 'Marina Souza', document: '52998224725' });
    const vehicle = await new CreateVehicle(repositories.vehicles, repositories.customers).execute({ customerId: customer.id!, plate: 'ABC1D23', brand: 'Honda', model: 'Civic', year: 2022 });
    const service = await new CreateService(repositories.services).execute({ name: 'Revisão', priceCents: 10000, estimatedMinutes: 60 });
    const firstPart = await new CreatePart(repositories.parts).execute({ sku: 'PECA-1', name: 'Peça 1', priceCents: 1000, stockQuantity: 1 });
    const secondPart = await new CreatePart(repositories.parts).execute({ sku: 'PECA-2', name: 'Peça 2', priceCents: 2000, stockQuantity: 1 });
    const create = new CreateWorkOrder(unitOfWork);
    const changeStatus = new ChangeWorkOrderStatus(unitOfWork);
    const decide = new DecideQuote(unitOfWork);
    const adjustStock = new AdjustStock(unitOfWork);
    const created = await create.execute({ customerId: customer.id!, vehicleId: vehicle.id!, complaint: 'Barulho no motor', items: [
      { type: ItemKind.Service, id: service.id!, quantity: 1 },
      { type: ItemKind.Part, id: firstPart.id!, quantity: 1 },
      { type: ItemKind.Part, id: secondPart.id!, quantity: 1 }
    ] });
    expect(created.quote_total_cents).toBe(13000);
    await changeStatus.execute(created.id!, WorkOrderStatus.Diagnosis);
    await changeStatus.execute(created.id!, WorkOrderStatus.AwaitingApproval);
    await adjustStock.execute(secondPart.id!, -1, 'Reserva externa');

    const eventCount = store.state.events.length;
    await expect(decide.execute(created.trackingCode, true)).rejects.toMatchObject({ kind: DomainErrorKind.Conflict });
    expect(store.state.events).toHaveLength(eventCount);
    expect((await repositories.parts.findById(firstPart.id!))?.stockQuantity).toBe(1);
    expect((await repositories.workOrders.findById(created.id!))?.status).toBe(WorkOrderStatus.AwaitingApproval);
    expect((await repositories.workOrders.findById(created.id!))?.decisions).toHaveLength(0);
    expect(await repositories.parts.movements(firstPart.id!)).toHaveLength(0);

    await decide.execute(created.trackingCode, false, 'Rever proposta', 1);
    expect((await repositories.parts.findById(firstPart.id!))?.stockQuantity).toBe(1);
    expect(store.state.events.at(-1)?.name).toBe(DomainEventName.QuoteRejected);
    await adjustStock.execute(secondPart.id!, 1, 'Reposição');
    await decide.execute(created.trackingCode, true);
    expect((await repositories.parts.findById(firstPart.id!))?.stockQuantity).toBe(0);
    expect((await repositories.workOrders.findById(created.id!))?.status).toBe(WorkOrderStatus.InProgress);
    const publicView = await new TrackWorkOrder(workOrderQueries).execute(created.trackingCode);
    expect(publicView.status).toBe(WorkOrderStatus.InProgress);
    expect(publicView).not.toHaveProperty('document');

    await adjustStock.execute(firstPart.id!, 1, 'Reposição adicional');
    await new ProposeAdditionalRepair(unitOfWork).execute({ workOrderId: created.id!, item: { type: ItemKind.Part, id: firstPart.id!, quantity: 1 } });
    expect((await repositories.workOrders.findById(created.id!))?.status).toBe(WorkOrderStatus.AwaitingApproval);
    await expect(decide.execute(created.trackingCode, true, undefined, 1)).rejects.toMatchObject({ kind: DomainErrorKind.Conflict });
    await decide.execute(created.trackingCode, true, undefined, 2);
    expect(store.state.events.map(event => event.name)).toContain(DomainEventName.ExecutionResumed);
    expect(store.state.events.filter(event => event.name === DomainEventName.PartsConsumed)).toHaveLength(3);
    await changeStatus.execute(created.id!, WorkOrderStatus.Finished);
    await changeStatus.execute(created.id!, WorkOrderStatus.Delivered);
    const detail = await new GetWorkOrder(workOrderQueries).execute(created.id!);
    expect(detail.status).toBe(WorkOrderStatus.Delivered);
    expect((detail.decisions as unknown[]).length).toBe(3);
    expect((await new GetAverageExecutionTime(workOrderQueries).execute()).completed_orders).toBe(1);
  });
});

registerCascadeDeletionTests('exclusão em cascata em memória', async check => {
  const environment = createInMemoryEnvironment();
  await check({ ...environment, eventCount: async () => environment.store.state.events.length });
});

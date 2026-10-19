import { describe, expect, it } from 'bun:test';
import { ApplicationError, ErrorKind } from '../../src/application/errors';
import type { RepositoryContext, UnitOfWork } from '../../src/application/unit-of-work';
import type { WorkOrderQueries } from '../../src/application/work-order-queries';
import { DeleteCustomer } from '../../src/application/use-cases/customer/delete-customer';
import { GetCustomer } from '../../src/application/use-cases/customer/get-customer';
import { ListCustomers } from '../../src/application/use-cases/customer/list-customers';
import { DeleteVehicle } from '../../src/application/use-cases/vehicle/delete-vehicle';
import { GetVehicle } from '../../src/application/use-cases/vehicle/get-vehicle';
import { ListVehicles } from '../../src/application/use-cases/vehicle/list-vehicles';
import { DeactivatePart } from '../../src/application/use-cases/part/deactivate-part';
import { GetPart } from '../../src/application/use-cases/part/get-part';
import { ListParts } from '../../src/application/use-cases/part/list-parts';
import { ListPartMovements } from '../../src/application/use-cases/part/list-part-movements';
import { DeactivateService } from '../../src/application/use-cases/service/deactivate-service';
import { GetService } from '../../src/application/use-cases/service/get-service';
import { ListServices } from '../../src/application/use-cases/service/list-services';
import { AdjustStock } from '../../src/application/use-cases/part/adjust-stock';
import { CreateWorkOrder } from '../../src/application/use-cases/work-order/create-work-order';
import { ChangeWorkOrderStatus } from '../../src/application/use-cases/work-order/change-work-order-status';
import { DecideQuote } from '../../src/application/use-cases/work-order/decide-quote';
import { GetWorkOrderHistory } from '../../src/application/use-cases/work-order/get-work-order-history';
import { ListWorkOrders } from '../../src/application/use-cases/work-order/list-work-orders';
import { GetAverageExecutionTime } from '../../src/application/use-cases/work-order/get-average-execution-time';
import { Customer } from '../../src/domain/customer/customer';
import { Vehicle } from '../../src/domain/vehicle/vehicle';
import { Service } from '../../src/domain/service/service';
import { Part } from '../../src/domain/part/part';
import { ItemKind } from '../../src/domain/work-order/work-order-item';
import { WorkOrderStatus } from '../../src/domain/work-order/status';

export interface DeletionEnvironment {
  repositories: RepositoryContext;
  unitOfWork: UnitOfWork;
  workOrderQueries: WorkOrderQueries;
  eventCount(): Promise<number>;
}

export async function seedDeletionFixture(env: DeletionEnvironment) {
  const { repositories: repos, unitOfWork } = env;
  const customer = await repos.customers.save(Customer.create({ name: 'Cliente da cascata', document: '52998224725' }));
  const otherCustomer = await repos.customers.save(Customer.create({ name: 'Outro cliente', document: '11144477735' }));
  const vehicle = await repos.vehicles.save(Vehicle.create({ customerId: customer.id!, plate: 'ABC1D23', brand: 'Honda', model: 'Civic', year: 2022 }));
  const siblingVehicle = await repos.vehicles.save(Vehicle.create({ customerId: customer.id!, plate: 'DEF4G56', brand: 'Ford', model: 'Ka', year: 2020 }));
  const otherVehicle = await repos.vehicles.save(Vehicle.create({ customerId: otherCustomer.id!, plate: 'GHI7J89', brand: 'Fiat', model: 'Uno', year: 2019 }));
  const service = await repos.services.save(Service.create({ name: 'Revisão', priceCents: 10000, estimatedMinutes: 60 }));
  const part = await repos.parts.save(Part.create({ sku: 'CASCADE-1', name: 'Filtro', priceCents: 2000, stockQuantity: 20 }));
  await new AdjustStock(unitOfWork).execute(part.id!, 2, 'Entrada independente de OS');

  const create = new CreateWorkOrder(unitOfWork);
  const status = new ChangeWorkOrderStatus(unitOfWork);
  const decide = new DecideQuote(unitOfWork);
  async function openOrder(ownerId: number, vehicleId: number, approve = true) {
    const order = await create.execute({ customerId: ownerId, vehicleId, complaint: 'Revisão preventiva', items: [
      { type: ItemKind.Service, id: service.id!, quantity: 1 },
      { type: ItemKind.Part, id: part.id!, quantity: 1 }
    ] });
    await status.execute(order.id!, WorkOrderStatus.Diagnosis);
    await status.execute(order.id!, WorkOrderStatus.AwaitingApproval);
    if (approve) await decide.execute(order.trackingCode, true, 'Aceito', 1);
    return order;
  }
  const order = await openOrder(customer.id!, vehicle.id!);
  const pendingOrder = await openOrder(customer.id!, vehicle.id!, false);
  const siblingOrder = await openOrder(customer.id!, siblingVehicle.id!);
  const otherOrder = await openOrder(otherCustomer.id!, otherVehicle.id!);
  return { customer, otherCustomer, vehicle, siblingVehicle, otherVehicle, service, part,
    order, pendingOrder, siblingOrder, otherOrder };
}

type WithEnvironment = (check: (env: DeletionEnvironment) => Promise<void>) => Promise<void>;

/** Mesmo contrato de exclusão executado contra os dois adaptadores. */
export function registerCascadeDeletionTests(label: string, withEnvironment: WithEnvironment): void {
  describe(label, () => {
    it('exclui cliente, todos os seus veículos e OS com seus filhos', () => withEnvironment(async env => {
      const data = await seedDeletionFixture(env);
      const events = await env.eventCount();
      expect(await new DeleteCustomer(env.repositories.customers).execute(data.customer.id!)).toEqual({ deleted: true });
      expect(await env.repositories.customers.findById(data.customer.id!)).toBeUndefined();
      for (const vehicle of [data.vehicle, data.siblingVehicle]) {
        expect(await env.repositories.vehicles.findById(vehicle.id!)).toBeUndefined();
      }
      for (const order of [data.order, data.pendingOrder, data.siblingOrder]) {
        expect(await env.repositories.workOrders.findById(order.id!)).toBeUndefined();
        expect(await env.workOrderQueries.detail(order.id!)).toBeUndefined();
        expect(await env.workOrderQueries.publicView(order.trackingCode)).toBeUndefined();
        expect(await env.workOrderQueries.history(order.id!)).toEqual([]);
      }
      expect(await env.repositories.customers.findById(data.otherCustomer.id!)).toEqual(data.otherCustomer);
      expect(await env.repositories.vehicles.findById(data.otherVehicle.id!)).toEqual(data.otherVehicle);
      expect(await env.repositories.workOrders.findById(data.otherOrder.id!)).toBeDefined();
      expect(await env.repositories.services.findById(data.service.id!)).toEqual(data.service);
      expect((await env.repositories.parts.findById(data.part.id!))?.stockQuantity).toBe(19);
      const movements = await env.repositories.parts.movements(data.part.id!);
      expect(movements).toHaveLength(4);
      expect(movements.filter(movement => movement.workOrderId === undefined)).toHaveLength(3);
      expect(movements.filter(movement => movement.workOrderId === data.otherOrder.id)).toHaveLength(1);
      expect(await env.eventCount()).toBe(events);
    }));

    it('exclui veículo e suas OS, preservando cliente e os demais veículos e ordens', () => withEnvironment(async env => {
      const data = await seedDeletionFixture(env);
      const movementsBefore = await env.repositories.parts.movements(data.part.id!);
      expect(await new DeleteVehicle(env.repositories.vehicles).execute(data.vehicle.id!)).toEqual({ deleted: true });
      expect(await env.repositories.vehicles.findById(data.vehicle.id!)).toBeUndefined();
      expect(await env.repositories.workOrders.findById(data.order.id!)).toBeUndefined();
      expect(await env.repositories.workOrders.findById(data.pendingOrder.id!)).toBeUndefined();
      expect(await env.repositories.customers.findById(data.customer.id!)).toEqual(data.customer);
      expect(await env.repositories.vehicles.findById(data.siblingVehicle.id!)).toEqual(data.siblingVehicle);
      expect(await env.repositories.workOrders.findById(data.siblingOrder.id!)).toBeDefined();
      expect(await env.repositories.workOrders.findById(data.otherOrder.id!)).toBeDefined();
      expect((await env.repositories.parts.findById(data.part.id!))?.stockQuantity).toBe(19);
      const movementsAfter = await env.repositories.parts.movements(data.part.id!);
      const oldMovement = movementsBefore.find(movement => movement.workOrderId === data.order.id)!;
      expect(movementsAfter.find(movement => movement.id === oldMovement.id)).toMatchObject({
        id: oldMovement.id, partId: oldMovement.partId, quantityDelta: oldMovement.quantityDelta,
        reason: oldMovement.reason, createdAt: oldMovement.createdAt, workOrderId: undefined
      });
      expect(movementsAfter).toHaveLength(movementsBefore.length);
    }));

    it('retorna not_found para exclusão inexistente ou repetida', () => withEnvironment(async env => {
      const data = await seedDeletionFixture(env);
      const customerDelete = new DeleteCustomer(env.repositories.customers);
      const vehicleDelete = new DeleteVehicle(env.repositories.vehicles);
      await expect(customerDelete.execute(999999)).rejects.toMatchObject({ kind: ErrorKind.NotFound });
      await expect(vehicleDelete.execute(999999)).rejects.toMatchObject({ kind: ErrorKind.NotFound });
      await vehicleDelete.execute(data.vehicle.id!);
      await expect(vehicleDelete.execute(data.vehicle.id!)).rejects.toMatchObject({ kind: ErrorKind.NotFound });
      await customerDelete.execute(data.customer.id!);
      await expect(customerDelete.execute(data.customer.id!)).rejects.toMatchObject({ kind: ErrorKind.NotFound });
      expect(await env.repositories.workOrders.findById(data.otherOrder.id!)).toBeDefined();
    }));

    it('reverte a cascata completa quando a transação falha', () => withEnvironment(async env => {
      const data = await seedDeletionFixture(env);
      const before = await env.repositories.workOrders.findById(data.order.id!);
      const movements = await env.repositories.parts.movements(data.part.id!);
      const events = await env.eventCount();
      await expect(env.unitOfWork.run(async context => {
        await context.customers.delete(data.customer.id!);
        throw new ApplicationError(ErrorKind.Conflict, 'Falha simulada após a cascata');
      })).rejects.toThrow('Falha simulada');
      expect(await env.repositories.customers.findById(data.customer.id!)).toEqual(data.customer);
      expect(await env.repositories.vehicles.findById(data.vehicle.id!)).toEqual(data.vehicle);
      expect(await env.repositories.vehicles.findById(data.siblingVehicle.id!)).toEqual(data.siblingVehicle);
      expect(await env.repositories.workOrders.findById(data.order.id!)).toEqual(before);
      expect(await env.repositories.workOrders.findById(data.pendingOrder.id!)).toBeDefined();
      expect(await env.repositories.workOrders.findById(data.siblingOrder.id!)).toBeDefined();
      expect(await env.repositories.parts.movements(data.part.id!)).toEqual(movements);
      expect(await env.eventCount()).toBe(events);
    }));

    it('desativa catálogo compartilhado sem apagar itens de OS nem movimentos', () => withEnvironment(async env => {
      const data = await seedDeletionFixture(env);
      const before = await env.repositories.workOrders.findById(data.order.id!);
      const movements = await env.repositories.parts.movements(data.part.id!);
      await new DeactivateService(env.repositories.services).execute(data.service.id!);
      await new DeactivatePart(env.repositories.parts).execute(data.part.id!);
      expect((await env.repositories.services.findById(data.service.id!))?.active).toBe(false);
      expect((await env.repositories.parts.findById(data.part.id!))?.active).toBe(false);
      expect(await env.repositories.workOrders.findById(data.order.id!)).toEqual(before);
      expect(await env.repositories.parts.movements(data.part.id!)).toEqual(movements);
    }));

    it('reflete a cascata nas listagens, detalhes, histórico e métricas', () => withEnvironment(async env => {
      const data = await seedDeletionFixture(env);
      const { repositories: repos, workOrderQueries } = env;
      const customer = new GetCustomer(repos.customers);
      const vehicle = new GetVehicle(repos.vehicles);
      const history = new GetWorkOrderHistory(repos.workOrders, workOrderQueries);
      const orders = new ListWorkOrders(workOrderQueries);
      const metrics = new GetAverageExecutionTime(workOrderQueries);
      expect((await customer.execute(data.customer.id!)).id).toBe(data.customer.id);
      expect((await vehicle.execute(data.vehicle.id!)).id).toBe(data.vehicle.id);
      expect((await history.execute(data.order.id!)).length).toBeGreaterThan(0);
      expect(await orders.execute(WorkOrderStatus.InProgress)).toHaveLength(3);
      await new ChangeWorkOrderStatus(env.unitOfWork).execute(data.order.id!, WorkOrderStatus.Finished);
      expect((await metrics.execute()).completed_orders).toBe(1);

      await new DeleteCustomer(env.repositories.customers).execute(data.customer.id!);
      await expect(customer.execute(data.customer.id!)).rejects.toMatchObject({ kind: ErrorKind.NotFound });
      await expect(vehicle.execute(data.vehicle.id!)).rejects.toMatchObject({ kind: ErrorKind.NotFound });
      await expect(history.execute(data.order.id!)).rejects.toMatchObject({ kind: ErrorKind.NotFound });
      expect((await new ListCustomers(repos.customers).execute()).map(record => record.id)).toEqual([data.otherCustomer.id]);
      expect((await new ListVehicles(repos.vehicles).execute()).map(record => record.id)).toEqual([data.otherVehicle.id]);
      expect((await orders.execute()).map(record => record.id)).toEqual([data.otherOrder.id]);
      expect((await metrics.execute()).completed_orders).toBe(0);
      expect((await new GetService(repos.services).execute(data.service.id!)).id).toBe(data.service.id);
      expect((await new GetPart(repos.parts).execute(data.part.id!)).stockQuantity).toBe(19);
      expect(await new ListServices(repos.services).execute()).toHaveLength(1);
      expect(await new ListParts(repos.parts).execute()).toHaveLength(1);
      expect(await new ListPartMovements(repos.parts).execute(data.part.id!)).toHaveLength(4);
    }));
  });
}

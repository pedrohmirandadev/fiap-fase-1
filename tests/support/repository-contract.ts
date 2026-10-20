import { describe, expect, it } from 'bun:test';
import type { RepositoryContext, UnitOfWork } from '../../src/application/unit-of-work';
import type { WorkOrderQueries } from '../../src/application/work-order-queries';
import type { AdminUser } from '../../src/domain/identity/admin-user';
import { Customer } from '../../src/domain/customer/customer';
import { Vehicle } from '../../src/domain/vehicle/vehicle';
import { Workshop } from '../../src/domain/workshop/workshop';
import { Service } from '../../src/domain/service/service';
import { Part } from '../../src/domain/part/part';
import { InventoryMovement } from '../../src/domain/part/inventory-movement';
import { WorkOrder } from '../../src/domain/work-order/work-order';
import { WorkOrderItem, ItemKind } from '../../src/domain/work-order/work-order-item';
import { WorkOrderStatus } from '../../src/domain/work-order/status';
import { StatusChange } from '../../src/domain/work-order/status-change';
import { ReceiveStock } from '../../src/application/use-cases/part/receive-stock';
import { Money, Quantity, VehiclePlate } from '../../src/domain/shared/value-objects';
import type { DomainEvent } from '../../src/domain/shared/domain-event';
import { createEntityFactories } from '../factories';

export interface RepositoryEnvironment {
  repositories: RepositoryContext;
  unitOfWork: UnitOfWork;
  workOrderQueries: WorkOrderQueries;
  addAdmin(user: AdminUser): Promise<void>;
  events(): Promise<Array<Pick<DomainEvent, 'id' | 'name' | 'aggregateType' | 'aggregateId' | 'occurredAt' | 'payload'>>>;
}
type WithEnvironment = (check: (env: RepositoryEnvironment) => Promise<void>) => Promise<void>;

async function expectConstraintFailure(operation: Promise<unknown>, postgresCode: '23505' | '23503') {
  const error: unknown = await operation.then(() => undefined, (error: unknown) => error);
  expect(error).toBeInstanceOf(Error);
  expect(error).toMatchObject(typeof error === 'object' && error !== null && 'code' in error
    ? { code: postgresCode } : { kind: 'conflict' });
}

export async function seedRepositoryFixture(env: RepositoryEnvironment) {
  const f = createEntityFactories(), r = env.repositories;
  const customer = await r.customers.save(f.customer({ id: undefined, email: undefined, phone: undefined }));
  const vehicle = await r.vehicles.save(f.vehicle({ id: undefined, customerId: customer.id! }));
  const service = await r.services.save(f.service({ id: undefined, description: undefined }));
  const part = await r.parts.save(f.part({ id: undefined, description: undefined }));
  const order = await r.workOrders.save(WorkOrder.create(customer.id!, vehicle.id!, 'Motor com ruído', [
    new WorkOrderItem(undefined, ItemKind.Service, service.id!, service.name, new Quantity(2), service.price),
    new WorkOrderItem(undefined, ItemKind.Part, part.id!, part.name, new Quantity(1), part.price)
  ]));
  return { customer, vehicle, service, part, order };
}

/** O mesmo contrato exercita implementações reais, sem simular SQL. */
export function registerRepositoryContract(label: string, withEnvironment: WithEnvironment) {
  describe(label, () => {
    it('clientes: persiste, hidrata VOs, atualiza, pagina e busca por documento', () => withEnvironment(async e => {
      const r = e.repositories.customers, f = createEntityFactories();
      expect(await r.findById(99999)).toBeUndefined();
      expect(await r.findByDocument('00000000000')).toBeUndefined();
      expect(await r.findAll(10, 0)).toEqual([]);
      const first = await r.save(f.customer({ id: undefined, email: undefined, phone: undefined }));
      const second = await r.save(f.customer({ id: undefined }));
      expect(first).toBeInstanceOf(Customer);
      expect(first.email).toBeUndefined();
      expect((await r.findByDocument(first.document.value))?.document.equals(first.document)).toBe(true);
      expect((await r.findAll(1, 1)).map(x => x.id)).toEqual([second.id]);
      const changed = first.rename('Cliente atualizado').changeEmail('novo@example.test').changePhone('11999990000');
      expect(await r.save(changed)).toEqual(changed);
      expect(await r.findById(first.id!)).toEqual(changed);
      await expectConstraintFailure(e.unitOfWork.run(c => c.customers.save(new Customer(undefined, 'Duplicado', first.document))), '23505');
      expect(await r.delete(second.id!)).toBe(true);
      expect(await r.delete(second.id!)).toBe(false);
    }));

    it('veículos: relacionamentos, placa única, atualização e exclusão', () => withEnvironment(async e => {
      const { customer, vehicle } = await seedRepositoryFixture(e), r = e.repositories.vehicles;
      expect(await r.findById(99999)).toBeUndefined();
      expect(await r.findAll()).toEqual([vehicle]);
      const other = await r.save(Vehicle.create({ customerId: customer.id!, plate: 'XYZ8J77', brand: 'Fiat', model: 'Uno', year: 2000 }));
      expect((await r.findAll()).map(v => v.id)).toEqual([vehicle.id, other.id]);
      expect(vehicle).toBeInstanceOf(Vehicle);
      expect(vehicle.belongsTo(customer.id!)).toBe(true);
      const changed = vehicle.changeBrand('Fiat').changeModel('Uno').changeYear(1999);
      expect(await r.save(changed)).toEqual(changed);
      await expectConstraintFailure(e.unitOfWork.run(c => c.vehicles.save(new Vehicle(undefined, customer.id!, vehicle.plate, 'Ford', 'Ka', 2020))), '23505');
      await expectConstraintFailure(e.unitOfWork.run(c => c.vehicles.save(new Vehicle(undefined, 99999, new VehiclePlate('XYZ9J88'), 'Ford', 'Ka', 2020))), '23503');
      expect(await r.delete(vehicle.id!)).toBe(true);
      expect(await r.delete(vehicle.id!)).toBe(false);
    }));

    it('serviços: criação, hidratação, alterações e ativação preservam identidade', () => withEnvironment(async e => {
      const r = e.repositories.services;
      expect(await r.findById(99999)).toBeUndefined();
      expect(await r.findAll()).toEqual([]);
      const saved = await r.save(Service.create({ name: 'Revisão', priceCents: 100, estimatedMinutes: 1 }));
      expect(saved).toBeInstanceOf(Service);
      expect(saved.description).toBeUndefined();
      const changed = saved.rename('Óleo').changeDescription('Troca completa').changePrice(new Money(0)).changeEstimatedMinutes(90).deactivate();
      expect(await r.save(changed)).toEqual(changed);
      expect(await r.findById(saved.id!)).toEqual(changed);
      expect(await r.findAll()).toEqual([changed]);
      const second = await r.save(Service.create({ name: 'Outro serviço', priceCents: 1, estimatedMinutes: 1 }));
      expect((await r.findAll()).map(s => s.id)).toEqual([saved.id, second.id]);
      expect((await r.save(changed.activate())).active).toBe(true);
    }));

    it('peças: SKU único, versões otimistas, saldo e hidratação de movimentos', () => withEnvironment(async e => {
      const { part, order } = await seedRepositoryFixture(e), r = e.repositories.parts;
      expect(await r.findById(99999, true)).toBeUndefined();
      expect(await r.movements(99999)).toEqual([]);
      expect(await r.findById(part.id!, true)).toEqual(part);
      expect(await r.findAll()).toEqual([part]);
      const second = await r.save(Part.create({ sku: 'SECOND-PART', name: 'Outra peça', priceCents: 1 }));
      expect((await r.findAll()).map(p => p.id)).toEqual([part.id, second.id]);
      expect(part).toBeInstanceOf(Part);
      const change = part.recordReceipt(new Quantity(3), 'Recebimento de peças');
      const updated = await r.save(change.part.rename('Peça nova').changeDescription('Descrição').changePrice(new Money(100)).changeMinimumStock(0).deactivate());
      expect(updated.version).toBe(part.version + 1);
      expect(updated.stockQuantity).toBe(13);
      expect(updated.active).toBe(false);
      await expect(e.unitOfWork.run(c => c.parts.save(part.receiveStock(1)))).rejects.toMatchObject({ kind: 'conflict' });
      await expectConstraintFailure(e.unitOfWork.run(c => c.parts.save(Part.create({ sku: part.sku, name: 'Duplicada', priceCents: 1 }))), '23505');
      const date = new Date('2026-01-01T12:00:00Z');
      await r.recordMovement(new InventoryMovement(undefined, part.id!, 3, 'Compra sem OS', undefined, date));
      await r.recordMovement(new InventoryMovement(undefined, part.id!, -1, 'Consumo na OS', order.id, date));
      const movements = await r.movements(part.id!);
      expect(movements).toHaveLength(2);
      expect(movements[0]).toBeInstanceOf(InventoryMovement);
      expect(movements[0]).toMatchObject({ quantityDelta: -1, workOrderId: order.id, createdAt: date });
      expect(movements[1]!.workOrderId).toBeUndefined();
      await expectConstraintFailure(e.unitOfWork.run(c => c.parts.recordMovement(new InventoryMovement(undefined, 99999, 1, 'Peça ausente'))), '23503');
      await expectConstraintFailure(e.unitOfWork.run(c => c.parts.recordMovement(new InventoryMovement(undefined, part.id!, 1, 'OS ausente', 99999))), '23503');
    }));

    it('oficinas: insere, consulta, atualiza e rejeita documento duplicado', () => withEnvironment(async e => {
      const r = e.repositories.workshops, f = createEntityFactories();
      expect(await r.findById(99999)).toBeUndefined();
      const saved = await r.save(f.workshop({ id: undefined, phone: undefined }));
      expect(saved).toBeInstanceOf(Workshop);
      expect(saved.phone).toBeUndefined();
      const changed = new Workshop(saved.id, 'Oficina atualizada', saved.document, 'Rua Nova, 10', '11999999999');
      expect(await r.save(changed)).toEqual(changed);
      expect(await r.findById(saved.id!)).toEqual(changed);
      await expectConstraintFailure(e.unitOfWork.run(c => c.workshops.save(new Workshop(undefined, 'Outra oficina', saved.document, 'Outra rua'))), '23505');
    }));

    it('administradores: encontra usuário com hash e não inventa usuário ausente', () => withEnvironment(async e => {
      const user = createEntityFactories().adminUser();
      expect(await e.repositories.users.findByEmail(user.email)).toBeUndefined();
      await e.addAdmin(user);
      expect(await e.repositories.users.findByEmail(user.email)).toEqual(user);
      expect(await e.repositories.users.findByEmail('ausente@example.test')).toBeUndefined();
    }));

    it('OS: hidrata agregado completo e salva apenas filhos novos sem duplicar histórico', () => withEnvironment(async e => {
      const { order, part } = await seedRepositoryFixture(e), r = e.repositories.workOrders;
      expect(await r.findById(99999)).toBeUndefined();
      expect(await r.findByTrackingCode('inexistente', true)).toBeUndefined();
      expect(await r.findById(order.id!, true)).toEqual(order);
      expect(await r.findByTrackingCode(order.trackingCode.value)).toEqual(order);
      expect(order).toBeInstanceOf(WorkOrder);
      expect(order.pendingEvents).toEqual([]);
      expect(order.items.every(x => x.id !== undefined)).toBe(true);
      let saved = await r.save(order.startDiagnosis('Análise'));
      saved = await r.save(saved.submitQuote('Apresentado'));
      saved = await r.save(saved.rejectQuote(undefined, 'Rever valor'));
      saved = await r.save(saved.approveQuote(undefined, 'Aceito'));
      expect(saved.items.find(x => x.kind === ItemKind.Part)?.consumed).toBe(true);
      expect(saved.decisions.map(x => x.approved)).toEqual([false, true]);
      expect(saved.decisions[0]!.id).toBeDefined();
      saved = await r.save(saved.proposeAdditionalRepair(new WorkOrderItem(undefined, ItemKind.Part, part.id!, 'Peça adicional', new Quantity(1), part.price)));
      saved = await r.save(saved.approveQuote());
      saved = await r.save(saved.finishRepair('Pronto'));
      saved = await r.save(saved.recordDelivery('Retirado'));
      expect(saved.status).toBe(WorkOrderStatus.Delivered);
      expect(saved.items).toHaveLength(3);
      expect(saved.decisions).toHaveLength(3);
      expect(saved.quoteVersion.value).toBe(2);
      expect(await r.save(saved)).toEqual(saved);
      expect(await r.findById(saved.id!)).toEqual(saved);
    }));

    it('OS: rejeita código repetido e referências de catálogo inexistentes', () => withEnvironment(async e => {
      const { order } = await seedRepositoryFixture(e);
      const duplicate = new WorkOrder(undefined, order.customerId, order.vehicleId, order.complaint, order.trackingCode, order.status, order.items.map(i => new WorkOrderItem(undefined, i.kind, i.catalogId, i.description, i.quantity, i.unitPrice)));
      await expectConstraintFailure(e.unitOfWork.run(c => c.workOrders.save(duplicate)), '23505');
      const invalid = WorkOrder.create(order.customerId, order.vehicleId, 'Peça ausente', [new WorkOrderItem(undefined, ItemKind.Part, 99999, 'Inválido', new Quantity(1), new Money(1))]);
      await expectConstraintFailure(e.unitOfWork.run(c => c.workOrders.save(invalid)), '23503');
    }));

    it('consultas: pagina, filtra, projeta detalhes e protege dados pessoais no acompanhamento', () => withEnvironment(async e => {
      const { order, customer } = await seedRepositoryFixture(e), q = e.workOrderQueries;
      expect(await q.detail(99999)).toBeUndefined();
      expect(await q.publicView('inexistente')).toBeUndefined();
      expect(await q.history(99999)).toEqual([]);
      expect(await q.averageExecutionMinutes()).toEqual({ completed_orders: 0, average_minutes: null });
      expect(await q.list(WorkOrderStatus.Finished)).toEqual([]);
      expect(await q.list(undefined, 1, 1)).toEqual([]);
      expect((await q.list())[0]).toMatchObject({ id: order.id, customer_name: customer.name });
      const detail = await q.detail(order.id!);
      expect(detail).toMatchObject({ document: customer.document.value, items: expect.any(Array), decisions: [], history: expect.any(Array) });
      const publicView = await q.publicView(order.trackingCode.value);
      expect(Object.keys(publicView!).sort()).toEqual(['trackingCode','status','complaint','vehicle','quoteTotalCents','quoteVersion','items','openedAt','updatedAt'].sort());
      expect(JSON.stringify(publicView)).not.toContain(customer.document.value);
      expect((publicView!.items as object[])[0]).not.toHaveProperty('catalogId');
      let saved = await e.repositories.workOrders.save(order.startDiagnosis().submitQuote().approveQuote());
      const started = new Date('2026-01-01T12:00:00Z'), finished = new Date('2026-01-01T12:15:00Z');
      saved = await e.repositories.workOrders.save(new WorkOrder(saved.id, saved.customerId, saved.vehicleId,
        saved.complaint, saved.trackingCode, WorkOrderStatus.Finished, saved.items, saved.decisions,
        [...saved.history.map(change => change.to === WorkOrderStatus.InProgress
          ? new StatusChange(change.from, change.to, change.note, started, change.id) : change),
          new StatusChange(WorkOrderStatus.InProgress, WorkOrderStatus.Finished, 'Concluído', finished)], saved.quoteVersion));
      expect((await q.history(saved.id!)).length).toBe(5);
      expect((await q.detail(saved.id!))!.decisions).toHaveLength(1);
      const metrics = await q.averageExecutionMinutes();
      expect(metrics.completed_orders).toBe(1);
      expect(metrics.average_minutes).toBe('15.00');
      expect(await q.list(WorkOrderStatus.Finished, 1, 0)).toHaveLength(1);
    }));

    it('unidade de trabalho: rollback inclui entidades, estoque, movimentos e eventos', () => withEnvironment(async e => {
      const { part, order } = await seedRepositoryFixture(e);
      await e.repositories.events.append([]);
      const before = await e.events();
      await expect(e.unitOfWork.run(async c => {
        const change = part.recordReceipt(new Quantity(1), 'Recebimento');
        await c.parts.save(change.part);
        await c.parts.recordMovement(change.movement);
        await c.events.append(change.events);
        await c.workOrders.save(order.startDiagnosis());
        throw new Error('Falha após persistir');
      })).rejects.toThrow('Falha após persistir');
      expect(await e.repositories.parts.findById(part.id!)).toEqual(part);
      expect(await e.repositories.parts.movements(part.id!)).toEqual([]);
      expect(await e.events()).toEqual(before);
      expect((await e.repositories.workOrders.findById(order.id!))?.status).toBe(WorkOrderStatus.Received);
      const value = await e.unitOfWork.run(async c => {
        const change = part.recordReceipt(new Quantity(2), 'Recebimento confirmado');
        await c.parts.save(change.part); await c.events.append(change.events);
        return 42;
      });
      expect(value).toBe(42);
      expect((await e.repositories.parts.findById(part.id!))?.stockQuantity).toBe(12);
      const events = await e.events();
      expect(events).toHaveLength(before.length + 1);
      expect(events.at(-1)).toMatchObject({
        name: 'StockReceived', aggregateType: 'Part', aggregateId: String(part.id),
        payload: { quantityDelta: 2, balance: 12 }, id: expect.any(String), occurredAt: expect.any(Date)
      });
    }));

    it('falha no event store reverte saldo e movimento do caso de uso', () => withEnvironment(async e => {
      const { part } = await seedRepositoryFixture(e);
      const before = await e.events();
      const failingUnitOfWork: UnitOfWork = {
        run: operation => e.unitOfWork.run(context => operation({ ...context,
          events: { append: async () => { throw new Error('Registro de eventos indisponível'); } }
        }))
      };
      await expect(new ReceiveStock(failingUnitOfWork).execute({ partId: part.id!, quantity: 3, reason: 'Compra' })).rejects.toThrow('Registro de eventos indisponível');
      expect(await e.repositories.parts.findById(part.id!)).toEqual(part);
      expect(await e.repositories.parts.movements(part.id!)).toEqual([]);
      expect(await e.events()).toEqual(before);
    }));
  });
}

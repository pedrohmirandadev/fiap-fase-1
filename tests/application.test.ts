import { describe, expect, it } from 'bun:test';
import { createMockEnvironment } from './mocks';
import { createUseCases } from '../src/composition';
import { ItemKind, WorkOrderItem } from '../src/domain/work-order/work-order-item';
import { WorkOrderStatus as Status } from '../src/domain/work-order/status';
import { DomainEventName } from '../src/domain/shared/domain-event';
import { Quantity } from '../src/domain/shared/value-objects';
import { WorkOrder } from '../src/domain/work-order/work-order';
import { resolveOrderItem } from '../src/application/resolve-order-item';
import { Part } from '../src/domain/part/part';
import type { CreateWorkOrderCommand } from '../src/application/use-cases/work-order/create-work-order';
import { createInMemoryEnvironment } from '../src/infrastructure/in-memory/context';
import { seedRepositoryFixture } from './support/repository-contract';

function setup() {
  const e = createMockEnvironment();
  return { ...e, cases: createUseCases(e.repositories, e.unitOfWork, e.workOrderQueries) };
}
type Environment = ReturnType<typeof setup>;

describe('Casos de uso: consultas, alterações e falhas', () => {
  const missing: Array<[string, (e: Environment) => Promise<unknown>]> = [
    ['get cliente', e => e.cases.customers.get.execute(999)],
    ['update cliente', e => e.cases.customers.update.execute(999, {})],
    ['delete cliente', e => e.cases.customers.delete.execute(999)],
    ['get veículo', e => e.cases.vehicles.get.execute(999)],
    ['update veículo', e => e.cases.vehicles.update.execute(999, {})],
    ['delete veículo', e => e.cases.vehicles.delete.execute(999)],
    ['get serviço', e => e.cases.services.get.execute(999)],
    ['update serviço', e => e.cases.services.update.execute(999, {})],
    ['deactivate serviço', e => e.cases.services.deactivate.execute(999)],
    ['get peça', e => e.cases.parts.get.execute(999)],
    ['update peça', e => e.cases.parts.update.execute(999, {})],
    ['deactivate peça', e => e.cases.parts.deactivate.execute(999)],
    ['movimentos peça', e => e.cases.parts.movements.execute(999)],
    ['receber estoque', e => e.cases.parts.adjustStock.execute(999, 1, 'Compra')],
    ['retirar estoque', e => e.cases.parts.adjustStock.execute(999, -1, 'Retirada')],
    ['get oficina', e => e.cases.workshops.get.execute(999)],
    ['get OS', e => e.cases.workOrders.get.execute(999)],
    ['track OS', e => e.cases.workOrders.track.execute('missing')],
    ['histórico OS', e => e.cases.workOrders.history.execute(999)],
    ['diagnóstico OS', e => e.cases.workOrders.changeStatus.execute(999, Status.Diagnosis)],
    ['apresentar orçamento', e => e.cases.workOrders.changeStatus.execute(999, Status.AwaitingApproval)],
    ['finalizar reparo', e => e.cases.workOrders.changeStatus.execute(999, Status.Finished)],
    ['entregar veículo', e => e.cases.workOrders.changeStatus.execute(999, Status.Delivered)],
    ['aprovar orçamento', e => e.cases.workOrders.decide.execute('missing', true)],
    ['rejeitar orçamento', e => e.cases.workOrders.decide.execute('missing', false)],
    ['reparo adicional', e => e.cases.workOrders.addItem.execute({ workOrderId: 999, item: { type: ItemKind.Part, id: 1, quantity: 1 } })]
  ];
  it.each(missing)('%s retorna not_found e não grava', async (_, execute) => {
    const e = setup(), r = e.repositories;
    r.customers.findById.mockResolvedValue(undefined); r.customers.delete.mockResolvedValue(false);
    r.vehicles.findById.mockResolvedValue(undefined); r.vehicles.delete.mockResolvedValue(false);
    r.services.findById.mockResolvedValue(undefined); r.parts.findById.mockResolvedValue(undefined);
    r.workshops.findById.mockResolvedValue(undefined); r.workOrders.findById.mockResolvedValue(undefined);
    r.workOrders.findByTrackingCode.mockResolvedValue(undefined);
    e.workOrderQueries.detail.mockResolvedValue(undefined); e.workOrderQueries.publicView.mockResolvedValue(undefined);
    await expect(execute(e)).rejects.toMatchObject({ kind: 'not_found' });
    for (const save of [r.customers.save, r.vehicles.save, r.services.save, r.parts.save, r.workOrders.save, r.workshops.save, r.events.append, r.parts.recordMovement]) expect(save).not.toHaveBeenCalled();
  });
  it.each([[undefined, undefined, 50, 0], ['999', '-2', 100, 0], ['-5', '10', 1, 10], ['abc', 'abc', 50, 0]] as const)('normaliza paginação %s/%s', async (limit, offset, expectedLimit, expectedOffset) => {
    const e = setup();
    e.repositories.customers.findAll.mockResolvedValue([]); e.workOrderQueries.list.mockResolvedValue([]);
    await e.cases.customers.list.execute(limit, offset);
    await e.cases.workOrders.list.execute(Status.Received, limit, offset);
    expect(e.repositories.customers.findAll).toHaveBeenCalledWith(expectedLimit, expectedOffset);
    expect(e.workOrderQueries.list).toHaveBeenCalledWith(Status.Received, expectedLimit, expectedOffset);
  });
  it('patch vazio preserva entidades e campos opcionais aceitam zero, false e string vazia', async () => {
    const e = setup(), r = e.repositories, f = e.fixtures;
    r.customers.findById.mockResolvedValue(f.customer); r.customers.save.mockImplementation(async x => x);
    r.vehicles.findById.mockResolvedValue(f.vehicle); r.vehicles.save.mockImplementation(async x => x);
    r.services.findById.mockResolvedValue(f.service); r.services.save.mockImplementation(async x => x);
    r.parts.findById.mockResolvedValue(f.part); r.parts.save.mockImplementation(async x => x);
    expect(await e.cases.customers.update.execute(f.customer.id!, {})).toBe(f.customer);
    expect(await e.cases.vehicles.update.execute(f.vehicle.id!, {})).toBe(f.vehicle);
    expect(await e.cases.services.update.execute(f.service.id!, {})).toBe(f.service);
    expect(await e.cases.parts.update.execute(f.part.id!, {})).toBe(f.part);
    expect(await e.cases.customers.update.execute(f.customer.id!, { email: '', phone: '' })).toMatchObject({ email: '', phone: '' });
    expect(await e.cases.services.update.execute(f.service.id!, { description: '', priceCents: 0, active: false })).toMatchObject({ description: '', price: { cents: 0 }, active: false });
    expect(await e.cases.parts.update.execute(f.part.id!, { description: '', priceCents: 0, minimumStock: 0, active: false })).toMatchObject({ description: '', price: { cents: 0 }, minimumStock: 0, active: false });
  });
  it('alteração inválida e criação com proprietário inexistente não chamam save', async () => {
    const e = setup();
    e.repositories.customers.findById.mockResolvedValue(e.fixtures.customer);
    await expect(e.cases.customers.update.execute(e.fixtures.customer.id!, { name: '' })).rejects.toThrow();
    expect(e.repositories.customers.save).not.toHaveBeenCalled();
    e.repositories.customers.findById.mockResolvedValue(undefined);
    await expect(e.cases.vehicles.create.execute({ customerId: 999, plate: 'ABC1D23', brand: 'Honda', model: 'Civic', year: 2020 })).rejects.toMatchObject({ kind: 'not_found' });
    expect(e.repositories.vehicles.save).not.toHaveBeenCalled();
  });
});

describe('Criação da OS e resolução do catálogo', () => {
  function configured() {
    const e = setup(), r = e.repositories, f = e.fixtures;
    r.customers.findById.mockResolvedValue(f.customer); r.customers.findByDocument.mockResolvedValue(f.customer);
    r.vehicles.findById.mockResolvedValue(f.vehicle); r.services.findById.mockResolvedValue(f.service);
    r.parts.findById.mockResolvedValue(f.part); r.workOrders.save.mockImplementation(async order => new WorkOrder(99, order.customerId, order.vehicleId, order.complaint, order.trackingCode, order.status, order.items, order.decisions, order.history));
    r.events.append.mockResolvedValue(undefined);
    return { ...e, input: { customerId: f.customer.id!, vehicleId: f.vehicle.id!, complaint: 'Ruído no motor', items: [{ type: ItemKind.Service, id: f.service.id!, quantity: 2 }] } };
  }
  it('cria por documento normalizado e publica fatos apenas depois de salvar', async () => {
    const e = configured(), calls: string[] = [];
    const save = e.repositories.workOrders.save.getMockImplementation()!;
    e.repositories.workOrders.save.mockImplementation(async order => { calls.push('save'); return save(order); });
    e.repositories.events.append.mockImplementation(async () => { calls.push('events'); });
    const result = await e.cases.workOrders.create.execute({ ...e.input, customerId: undefined, customerDocument: e.fixtures.customer.document.value });
    expect(result).toMatchObject({ id: 99, quote_total_cents: 36000, status: Status.Received });
    expect(e.repositories.customers.findByDocument).toHaveBeenCalledWith(e.fixtures.customer.document.value);
    expect(calls).toEqual(['save', 'events']);
    expect(e.repositories.events.append.mock.calls[0]![0].map(x => x.name)).toEqual([DomainEventName.WorkOrderReceived, DomainEventName.QuoteCalculated]);
    expect(e.unitOfWork.run).toHaveBeenCalledTimes(1);
  });
  it.each(['sem itens', 'sem cliente', 'documento divergente', 'cliente ausente', 'veículo ausente', 'outro proprietário', 'serviço ausente', 'serviço inativo', 'peça ausente', 'peça inativa', 'estoque agregado insuficiente'])('rejeita %s sem gravar OS/eventos', async scenario => {
    const e = configured(), r = e.repositories;
    let input: CreateWorkOrderCommand = e.input;
    switch (scenario) {
      case 'sem itens': input = { ...input, items: [] }; break;
      case 'sem cliente': input = { ...input, customerId: undefined }; break;
      case 'documento divergente': input = { ...input, customerId: 999, customerDocument: e.fixtures.customer.document.value }; break;
      case 'cliente ausente': r.customers.findById.mockResolvedValue(undefined); break;
      case 'veículo ausente': r.vehicles.findById.mockResolvedValue(undefined); break;
      case 'outro proprietário': r.vehicles.findById.mockResolvedValue(e.factories.vehicle({ customerId: 999 })); break;
      case 'serviço ausente': r.services.findById.mockResolvedValue(undefined); break;
      case 'serviço inativo': r.services.findById.mockResolvedValue(e.fixtures.service.deactivate()); break;
      case 'peça ausente': r.parts.findById.mockResolvedValue(undefined); input = { ...input, items: [{ type: ItemKind.Part, id: 1, quantity: 1 }] }; break;
      case 'peça inativa': r.parts.findById.mockResolvedValue(e.fixtures.part.deactivate()); input = { ...input, items: [{ type: ItemKind.Part, id: 1, quantity: 1 }] }; break;
      case 'estoque agregado insuficiente': input = { ...input, items: [1, 2].map(() => ({ type: ItemKind.Part, id: e.fixtures.part.id!, quantity: 6 })) }; break;
    }
    await expect(Promise.resolve().then(() => e.cases.workOrders.create.execute(input))).rejects.toThrow();
    expect(r.workOrders.save).not.toHaveBeenCalled(); expect(r.events.append).not.toHaveBeenCalled();
  });
  it('quantidade inválida é rejeitada antes de consultar catálogo', async () => {
    const e = configured();
    await expect(resolveOrderItem(e.repositories, { type: ItemKind.Service, id: 1, quantity: 0 })).rejects.toThrow();
    expect(e.repositories.services.findById).not.toHaveBeenCalled();
  });
  it('falha da persistência é propagada e não publica eventos', async () => {
    const e = configured();
    e.repositories.workOrders.save.mockRejectedValue(new Error('Banco indisponível'));
    await expect(e.cases.workOrders.create.execute(e.input)).rejects.toThrow('Banco indisponível');
    expect(e.repositories.events.append).not.toHaveBeenCalled();
  });
});

describe('Comandos transacionais de estoque e orçamento', () => {
  it.each([2, -2])('movimento %s exige lock e persiste saldo, movimento e eventos', async delta => {
    const e = setup(), r = e.repositories, calls: string[] = [];
    r.parts.findById.mockResolvedValue(e.fixtures.part);
    r.parts.save.mockImplementation(async part => { calls.push('save'); return part; });
    r.parts.recordMovement.mockImplementation(async () => { calls.push('movement'); });
    r.events.append.mockImplementation(async () => { calls.push('events'); });
    const updated = await e.cases.parts.adjustStock.execute(e.fixtures.part.id!, delta, 'Ajuste manual');
    expect(updated.stockQuantity).toBe(10 + delta);
    expect(r.parts.findById).toHaveBeenCalledWith(e.fixtures.part.id!, true);
    expect(r.parts.recordMovement.mock.calls[0]![0]).toMatchObject({ quantityDelta: delta, reason: 'Ajuste manual' });
    expect(calls).toEqual(['save', 'movement', 'events']);
  });
  it('aprovação agrega quantidades da mesma peça e adquire locks por ID crescente', async () => {
    const e = setup(), r = e.repositories;
    const part2 = e.factories.part({ id: 2 }), part8 = e.factories.part({ id: 8 });
    const items = [8, 2, 8].map(id => new WorkOrderItem(undefined, ItemKind.Part, id, 'Peça', new Quantity(1), part2.price));
    const order = e.factories.workOrder({ items }).startDiagnosis().submitQuote();
    r.workOrders.findByTrackingCode.mockResolvedValue(order);
    r.parts.findById.mockImplementation(async id => id === 2 ? part2 : part8);
    r.parts.save.mockImplementation(async p => p); r.parts.recordMovement.mockResolvedValue(undefined);
    r.workOrders.save.mockImplementation(async o => o); r.events.append.mockResolvedValue(undefined);
    expect(await e.cases.workOrders.decide.execute(order.trackingCode.value, true)).toMatchObject({ approved: true });
    expect(r.workOrders.findByTrackingCode).toHaveBeenCalledWith(order.trackingCode.value, true);
    expect(r.parts.findById.mock.calls).toEqual([[2, true], [8, true]]);
    expect(r.parts.recordMovement.mock.calls.map(call => call[0].quantityDelta)).toEqual([-1, -2]);
  });
  it.each([true, false])('decisão %s de versão antiga não consome nem salva', async approved => {
    const e = setup(), r = e.repositories;
    const order = e.fixtures.workOrder.startDiagnosis().submitQuote();
    r.workOrders.findByTrackingCode.mockResolvedValue(order);
    await expect(e.cases.workOrders.decide.execute(order.trackingCode.value, approved, undefined, 2)).rejects.toMatchObject({ kind: 'conflict' });
    expect(r.parts.save).not.toHaveBeenCalled(); expect(r.parts.recordMovement).not.toHaveBeenCalled();
    expect(r.workOrders.save).not.toHaveBeenCalled(); expect(r.events.append).not.toHaveBeenCalled();
  });
  it('rejeição não consulta nem altera estoque', async () => {
    const e = setup(), r = e.repositories;
    const order = e.fixtures.workOrder.startDiagnosis().submitQuote();
    r.workOrders.findByTrackingCode.mockResolvedValue(order); r.workOrders.save.mockImplementation(async o => o); r.events.append.mockResolvedValue(undefined);
    expect(await e.cases.workOrders.decide.execute(order.trackingCode.value, false, 'Rever')).toMatchObject({ approved: false });
    expect(r.parts.findById).not.toHaveBeenCalled(); expect(r.parts.save).not.toHaveBeenCalled();
    expect(r.workOrders.save.mock.calls[0]![0].decisions[0]).toMatchObject({ approved: false, reason: 'Rever' });
  });
  it('peça removida após orçamento impede aprovação antes de gravar', async () => {
    const e = setup(), r = e.repositories;
    const order = e.fixtures.workOrder.startDiagnosis().submitQuote();
    r.workOrders.findByTrackingCode.mockResolvedValue(order); r.parts.findById.mockResolvedValue(undefined);
    await expect(e.cases.workOrders.decide.execute(order.trackingCode.value, true)).rejects.toMatchObject({ kind: 'not_found' });
    expect(r.workOrders.save).not.toHaveBeenCalled(); expect(r.events.append).not.toHaveBeenCalled();
  });
  it('rollback reverte consumo parcial quando outra peça fica indisponível', async () => {
    const memory = createInMemoryEnvironment();
    const env = { ...memory, addAdmin: async () => {}, events: async () => memory.store.state.events };
    const data = await seedRepositoryFixture(env);
    const second = await memory.repositories.parts.save(Part.create({ sku: 'SECOND', name: 'Segunda peça', priceCents: 100, stockQuantity: 5 }));
    const items = [data.part, second].map(part => new WorkOrderItem(undefined, ItemKind.Part, part.id!, part.name, new Quantity(1), part.price));
    const order = await memory.repositories.workOrders.save(WorkOrder.create(data.customer.id!, data.vehicle.id!, 'Duas peças', items).startDiagnosis().submitQuote());
    await memory.repositories.parts.save(second.withdrawStock(second.stockQuantity));
    const cases = createUseCases(memory.repositories, memory.unitOfWork, memory.workOrderQueries);
    await expect(cases.workOrders.decide.execute(order.trackingCode.value, true)).rejects.toMatchObject({ kind: 'conflict' });
    expect((await memory.repositories.parts.findById(data.part.id!))?.stockQuantity).toBe(data.part.stockQuantity);
    expect(await memory.repositories.parts.movements(data.part.id!)).toEqual([]);
    expect(memory.store.state.events).toEqual([]);
    expect((await memory.repositories.workOrders.findById(order.id!))?.status).toBe(Status.AwaitingApproval);
  });
});

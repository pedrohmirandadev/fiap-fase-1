import { describe, expect, it } from 'bun:test';
import { Customer } from '../src/domain/customer/customer';
import { isValidCpfCnpj, normalizeDocument } from '../src/domain/customer/tax-document';
import { Vehicle } from '../src/domain/vehicle/vehicle';
import { isValidPlate } from '../src/domain/vehicle/vehicle-plate';
import { Service } from '../src/domain/service/service';
import { Part } from '../src/domain/part/part';
import { Workshop } from '../src/domain/workshop/workshop';
import { InventoryMovement } from '../src/domain/part/inventory-movement';
import { TaxDocument, VehiclePlate, Money, Quantity, TrackingCode } from '../src/domain/shared/value-objects';
import { StockBalance } from '../src/domain/shared/stock-balance';
import { DomainError } from '../src/domain/shared/domain-error';
import { DomainEvent, DomainEventName, AggregateType } from '../src/domain/shared/domain-event';
import { WorkOrder } from '../src/domain/work-order/work-order';
import { WorkOrderItem, ItemKind } from '../src/domain/work-order/work-order-item';
import { WorkOrderStatus } from '../src/domain/work-order/status';
import { Quote, quoteTotalCents } from '../src/domain/work-order/quote';
import { QuoteVersion } from '../src/domain/work-order/quote-version';
import { createEntityFactories } from './factories';

const factories = createEntityFactories();
describe('Objetos de valor', () => {
  it.each(['529.982.247-25', '11144477735', '11.222.333/0001-81'])('normaliza e valida documento %s', input => {
    const document = new TaxDocument(input);
    expect(document.value).toBe(normalizeDocument(input));
    expect(document.equals(new TaxDocument(document.value))).toBe(true);
    expect(Object.isFrozen(document)).toBe(true);
  });
  it.each(['', '1', '00000000000', '11111111111111', '52998224726', '11222333000182'])('rejeita documento %s', value => {
    expect(isValidCpfCnpj(value)).toBe(false);
    expect(() => new TaxDocument(value)).toThrow(DomainError);
  });
  it('placas equivalentes são normalizadas; formato inválido é rejeitado', () => {
    expect(new VehiclePlate('abc-1234').equals(new VehiclePlate('ABC1234'))).toBe(true);
    expect(isValidPlate('abc1d23')).toBe(true);
    expect(() => new VehiclePlate('12ABC34')).toThrow(DomainError);
    expect(new VehiclePlate('ABC1D23').equals(new VehiclePlate('XYZ1234'))).toBe(false);
  });
  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('dinheiro e saldo rejeitam %s', value => {
    expect(() => new Money(value)).toThrow(DomainError);
    expect(() => new StockBalance(value)).toThrow(DomainError);
  });
  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('quantidade e versão rejeitam %s', value => {
    expect(() => new Quantity(value)).toThrow(DomainError);
    expect(() => new QuoteVersion(value)).toThrow(DomainError);
  });
  it('operações monetárias usam centavos, não mutam o original e detectam overflow', () => {
    const money = new Money(100);
    expect(money.add(new Money(50)).cents).toBe(150);
    expect(money.multiply(3).cents).toBe(300);
    expect(money.cents).toBe(100);
    expect(money.equals(new Money(100))).toBe(true);
    expect(money.equals(new Money(101))).toBe(false);
    expect(() => new Money(Number.MAX_SAFE_INTEGER).add(new Money(1))).toThrow();
    expect(() => money.multiply(0)).toThrow();
    expect(new Quantity(1).equals(new Quantity(2))).toBe(false);
    expect(new Quantity(1).equals(new Quantity(1))).toBe(true);
    expect(new QuoteVersion().next().value).toBe(2);
  });
  it('saldo recebe, retira até zero, compara e rejeita retirada excessiva', () => {
    const balance = new StockBalance(2);
    expect(balance.receive(new Quantity(3)).value).toBe(5);
    expect(balance.withdraw(new Quantity(2)).value).toBe(0);
    expect(balance.value).toBe(2);
    expect(balance.equals(new StockBalance(2))).toBe(true);
    expect(balance.equals(new StockBalance(3))).toBe(false);
    expect(() => balance.withdraw(new Quantity(3))).toThrow(DomainError);
  });
  it('código público tem entropia, tamanho e alfabeto próprios', () => {
    const codes = Array.from({ length: 100 }, () => TrackingCode.generate().value);
    expect(new Set(codes).size).toBe(100);
    expect(codes.every(code => /^[A-Za-z0-9_-]{32}$/.test(code))).toBe(true);
    expect(new TrackingCode(codes[0]!).equals(new TrackingCode(codes[0]!))).toBe(true);
    expect(new TrackingCode(codes[0]!).equals(new TrackingCode(codes[1]!))).toBe(false);
    expect(() => new TrackingCode('123')).toThrow(DomainError);
  });
  it('orçamento compara conteúdo e versão, calculando quantidade de cada item', () => {
    const items = [factories.workOrderItem({ quantity: 2, unitPriceCents: 250 })];
    const quote = Quote.calculate(items, new QuoteVersion());
    expect(quote.total.cents).toBe(500);
    expect(quote.equals(new Quote(new Money(500), new QuoteVersion(1)))).toBe(true);
    expect(quote.equals(new Quote(new Money(500), new QuoteVersion(2)))).toBe(false);
    expect(quoteTotalCents([{ quantity: 2, unitPriceCents: 250 }])).toBe(500);
    expect(quoteTotalCents([])).toBe(0);
  });
});

describe('Entidades e agregado de estoque', () => {
  it('cliente preserva identidade e documento em alterações explícitas', () => {
    const customer = factories.customer();
    const changed = customer.rename('  Novo nome  ').changeEmail('novo@example.test').changePhone('11999999999');
    expect(changed.id).toBe(customer.id);
    expect(changed.document).toBe(customer.document);
    expect(changed.name).toBe('Novo nome');
    expect(customer.name).not.toBe(changed.name);
    expect(Object.isFrozen(changed)).toBe(true);
    expect(() => customer.rename(' ')).toThrow(DomainError);
    expect(() => Customer.create({ name: 'A', document: customer.document.value })).toThrow(DomainError);
  });
  it.each([{ customerId: 0 }, { customerId: 1.5 }, { brand: '' }, { model: ' ' }, { year: 1949 }, { year: 2101 }, { year: 2020.5 }])('veículo rejeita dados inválidos %j', changes => {
    expect(() => Vehicle.create({ customerId: 1, plate: 'ABC1D23', brand: 'Honda', model: 'Civic', year: 2020, ...changes })).toThrow(DomainError);
  });
  it('veículo aceita limites de ano e mantém proprietário/placa ao alterar', () => {
    const v = factories.vehicle();
    const changed = v.changeBrand(' Ford ').changeModel(' Ka ').changeYear(1950);
    expect(changed).toMatchObject({ id: v.id, customerId: v.customerId, plate: v.plate, brand: 'Ford', model: 'Ka', year: 1950 });
    expect(changed.changeYear(2100).year).toBe(2100);
    expect(v.belongsTo(v.customerId + 1)).toBe(false);
  });
  it.each([{ name: ' ' }, { estimatedMinutes: 0 }, { estimatedMinutes: 1.5 }, { priceCents: -1 }])('serviço rejeita %j', changes => {
    expect(() => Service.create({ name: 'Revisão', priceCents: 100, estimatedMinutes: 30, ...changes })).toThrow(DomainError);
  });
  it('ações de serviço não alteram outras propriedades nem original', () => {
    const s = factories.service();
    const changed = s.rename(' Novo ').changeDescription('Descrição').changePrice(new Money(0)).changeEstimatedMinutes(1).deactivate();
    expect(changed).toMatchObject({ id: s.id, name: 'Novo', description: 'Descrição', estimatedMinutes: 1, active: false });
    expect(changed.price.cents).toBe(0);
    expect(changed.activate().active).toBe(true);
    expect(s.active).toBe(true);
  });
  it.each([{ sku: '' }, { name: ' ' }, { stockQuantity: -1 }, { stockQuantity: 1.5 }, { minimumStock: -1 }])('peça rejeita %j', changes => {
    expect(() => Part.create({ sku: 'A1', name: 'Filtro', priceCents: 0, ...changes })).toThrow(DomainError);
  });
  it('estoque e alterações da peça preservam identidade e versão até persistência', () => {
    const p = factories.part({ stockQuantity: 10, minimumStock: 2 });
    const changed = p.rename(' Novo ').changeDescription('Descrição').changePrice(new Money(0)).changeMinimumStock(0).deactivate();
    expect(changed).toMatchObject({ id: p.id, sku: p.sku, version: p.version, active: false, name: 'Novo', minimumStock: 0 });
    expect(changed.activate().active).toBe(true);
    expect(() => changed.ensureAvailable(1)).toThrow(DomainError);
    expect(() => p.ensureAvailable(11)).toThrow(DomainError);
    expect(() => p.receiveStock(0)).toThrow(DomainError);
    expect(() => p.withdrawStock(-1)).toThrow(DomainError);
    expect(() => p.withdrawStock(11)).toThrow(DomainError);
    expect(p.stockQuantity).toBe(10);
  });
  it('eventos de estoque refletem operação, saldo e cruzamento do estoque mínimo', () => {
    const p = factories.part({ stockQuantity: 3, minimumStock: 2 });
    const withdrawal = p.recordWithdrawal(new Quantity(1), 'Retirada manual');
    expect(withdrawal.events.map(e => e.name)).toEqual([DomainEventName.StockWithdrawn, DomainEventName.MinimumStockReached]);
    expect(withdrawal.movement.quantityDelta).toBe(-1);
    expect(withdrawal.events[1]!.payload).toEqual({ balance: 2, minimumStock: 2 });
    expect(withdrawal.part.recordWithdrawal(new Quantity(1), 'Nova retirada').events).toHaveLength(1);
    const consumption = p.consumeForWorkOrder(new Quantity(1), 9);
    expect(consumption.events[0]).toMatchObject({ name: DomainEventName.PartsConsumed, aggregateId: String(p.id), payload: { quantityDelta: -1, balance: 2, workOrderId: 9 } });
    expect(consumption.movement.workOrderId).toBe(9);
    expect(p.recordReceipt(new Quantity(2), 'Compra').events[0]!.name).toBe(DomainEventName.StockReceived);
    expect(() => Part.create({ sku: 'N', name: 'Nova', priceCents: 1 }).recordReceipt(new Quantity(1), 'Compra')).toThrow(DomainError);
  });
  it.each([{ partId: 0 }, { partId: 0.5 }, { quantityDelta: 0 }, { quantityDelta: 0.1 }, { reason: '  ' }, { workOrderId: 0 }, { workOrderId: 1.5 }])('movimento rejeita %j', changes => {
    const value = { partId: 1, quantityDelta: 1, reason: 'Compra', workOrderId: undefined as number | undefined, ...changes };
    expect(() => new InventoryMovement(undefined, value.partId, value.quantityDelta, value.reason, value.workOrderId)).toThrow(DomainError);
  });
  it('oficina valida nome/endereço, normaliza e mantém dados de contato', () => {
    const f = factories.workshop();
    expect(Workshop.create({ name: ' Oficina ', document: f.document.value, address: ' Rua X ', phone: '11' })).toMatchObject({ name: 'Oficina', address: 'Rua X', phone: '11' });
    expect(() => Workshop.create({ name: 'A', document: f.document.value, address: 'Rua X' })).toThrow(DomainError);
    expect(() => Workshop.create({ name: 'Oficina', document: f.document.value, address: '  ' })).toThrow(DomainError);
  });
  it('evento captura uma cópia do payload e identifica agregado e ocorrência', () => {
    const payload = { balance: 1 };
    const event = new DomainEvent(DomainEventName.StockReceived, AggregateType.Part, '1', payload);
    payload.balance = 99;
    expect(event.payload.balance).toBe(1);
    expect(event.id).toMatch(/^[a-f0-9-]{36}$/);
    expect(event.occurredAt).toBeInstanceOf(Date);
    expect(Object.isFrozen(event.payload)).toBe(true);
    expect(Object.isFrozen(event)).toBe(true);
  });
});

describe('Agregado OS e entidades internas', () => {
  it.each([{ kind: 'INVALID' as ItemKind }, { catalogId: 0 }, { catalogId: 1.5 }, { description: ' ' }, { consumed: true, kind: ItemKind.Service }])('item rejeita %j', changes => {
    expect(() => factories.workOrderItem(changes)).toThrow(DomainError);
  });
  it('somente peças não consumidas podem ser marcadas; preço histórico fica preservado', () => {
    const part = factories.workOrderItem({ kind: ItemKind.Part, quantity: 2, unitPriceCents: 100 });
    const consumed = part.markConsumed();
    expect(consumed.total.cents).toBe(200);
    expect(part.consumed).toBe(false);
    expect(() => consumed.markConsumed()).toThrow(DomainError);
    expect(() => factories.workOrderItem({ kind: ItemKind.Service }).markConsumed()).toThrow(DomainError);
  });
  it('não cria OS sem itens, cliente, veículo ou relato válido', () => {
    const items = [factories.workOrderItem()];
    expect(() => WorkOrder.create(1, 1, 'Relato', [])).toThrow(DomainError);
    for (const [customerId, vehicleId, complaint] of [[0, 1, 'Relato'], [1, 0, 'Relato'], [1, 1, ' ']] as const) {
      expect(() => WorkOrder.create(customerId, vehicleId, complaint, items)).toThrow(DomainError);
    }
  });
  it('copia coleções recebidas, preserva eventos e protege histórico', () => {
    const items = [factories.workOrderItem()];
    const order = WorkOrder.create(1, 1, ' Ruído ', items);
    items.pop();
    expect(order.items).toHaveLength(1);
    expect(order.complaint).toBe('Ruído');
    expect(order.pendingEvents.map(e => e.name)).toEqual([DomainEventName.WorkOrderReceived, DomainEventName.QuoteCalculated]);
    expect(Object.isFrozen(order.items)).toBe(true);
    expect(Object.isFrozen(order.history)).toBe(true);
    expect(Object.isFrozen(order.decisions)).toBe(true);
    expect(Object.isFrozen(order.pendingEvents)).toBe(true);
    expect(order.history[0]!.from).toBeNull();
  });
  it('cada estado rejeita ações incompatíveis, inclusive repetição e versão antiga', () => {
    const received = factories.workOrder();
    for (const action of [() => received.submitQuote(), () => received.approveQuote(), () => received.rejectQuote(), () => received.finishRepair(), () => received.recordDelivery(), () => received.proposeAdditionalRepair(factories.workOrderItem())]) expect(action).toThrow(DomainError);
    const diagnosis = received.startDiagnosis();
    expect(() => diagnosis.startDiagnosis()).toThrow(DomainError);
    const awaiting = diagnosis.submitQuote();
    expect(() => awaiting.approveQuote(new QuoteVersion(2))).toThrow(DomainError);
    expect(() => awaiting.rejectQuote(new QuoteVersion(2))).toThrow(DomainError);
    const rejected = awaiting.rejectQuote(undefined, 'Preço alto');
    expect(rejected.status).toBe(WorkOrderStatus.AwaitingApproval);
    expect(rejected.decisions[0]).toMatchObject({ approved: false, reason: 'Preço alto' });
    const running = rejected.approveQuote();
    expect(running.pendingEvents.at(-1)!.name).toBe(DomainEventName.ExecutionStarted);
    const revised = running.proposeAdditionalRepair(factories.workOrderItem());
    expect(revised.quoteVersion.value).toBe(2);
    expect(revised.pendingEvents.slice(-4).map(e => e.name)).toEqual([DomainEventName.AdditionalRepairProposed, DomainEventName.ExecutionPaused, DomainEventName.QuoteRevised, DomainEventName.QuoteSubmitted]);
    expect(revised.approveQuote().pendingEvents.at(-1)!.name).toBe(DomainEventName.ExecutionResumed);
    const delivered = revised.approveQuote().finishRepair().recordDelivery();
    expect(delivered.pendingEvents.at(-1)!.name).toBe(DomainEventName.VehicleDelivered);
    expect(() => delivered.recordDelivery()).toThrow(DomainError);
    expect(() => new WorkOrder(1, 1, 1, 'Relato', received.trackingCode, WorkOrderStatus.Diagnosis).submitQuote()).toThrow(DomainError);
  });
});

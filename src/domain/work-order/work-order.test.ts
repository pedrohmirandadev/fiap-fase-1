import { DomainEventName } from '../shared/domain-event';
import { WorkOrderStatus } from './status';
import { describe, expect, it } from 'bun:test';
import { WorkOrder } from './work-order';
import { WorkOrderItem, ItemKind } from './work-order-item';
import { StockBalance } from '../shared/stock-balance';
import { Quote } from './quote';
import { TaxDocument, VehiclePlate, TrackingCode, Money, Quantity } from '../shared/value-objects';

describe('agregado Ordem de Serviço', () => {
  const service = () => new WorkOrderItem(undefined, ItemKind.Service, 1, 'Revisão', new Quantity(2), new Money(12500));
  it('calcula o orçamento e guarda o primeiro evento', () => {
    const order = WorkOrder.create(1, 2, 'Revisão preventiva', [service()]);
    expect(order.quote.cents).toBe(25000);
    expect(order.history[0].to).toBe(WorkOrderStatus.Received);
  });
  it('não permite iniciar reparo sem aprovação', () => {
    const order = WorkOrder.create(1, 2, 'Revisão preventiva', [service()])
      .startDiagnosis().submitQuote();
    expect(() => order.finishRepair()).toThrow();
    const approved = order.approveQuote();
    expect(approved.status).toBe(WorkOrderStatus.InProgress);
    expect(approved.decisions).toHaveLength(1);
  });
  it('reparo adicional exige nova aprovação', () => {
    const order = WorkOrder.create(1, 2, 'Revisão preventiva', [service()])
      .startDiagnosis().submitQuote().approveQuote();
    const additional = order.proposeAdditionalRepair(new WorkOrderItem(undefined, ItemKind.Part, 1, 'Filtro', new Quantity(1), new Money(3500)));
    expect(additional.status).toBe(WorkOrderStatus.AwaitingApproval);
    expect(additional.quote.cents).toBe(28500);
  });
});

it('protege snapshots, preserva decisões por versão e rejeita orçamento obsoleto', () => {
  const item = new WorkOrderItem(undefined, ItemKind.Part, 1, 'Filtro', new Quantity(1), new Money(3500));
  const originalItems = [item];
  const received = WorkOrder.create(1, 2, 'Revisão preventiva', originalItems);
  originalItems.push(item);
  expect(received.items).toHaveLength(1);
  expect(Object.isFrozen(received.items)).toBe(true);
  const waiting = received.startDiagnosis().submitQuote();
  const rejected = waiting.rejectQuote(waiting.quoteVersion, 'Rever orçamento');
  expect(rejected.status).toBe(WorkOrderStatus.AwaitingApproval);
  expect(rejected.items[0].consumed).toBe(false);
  const approved = rejected.approveQuote();
  expect(approved.items[0].consumed).toBe(true);
  const revised = approved.proposeAdditionalRepair(item);
  expect(revised.quoteVersion.value).toBe(2);
  expect(revised.decisions[0].quoteVersion.value).toBe(1);
  expect(() => revised.approveQuote(waiting.quoteVersion)).toThrow('Orçamento alterado');
  expect(revised.approveQuote().pendingEvents.map(event => event.name)).toContain(DomainEventName.ExecutionResumed);
  expect(() => approved.items[0].markConsumed()).toThrow();
  expect(() => waiting.recordDelivery()).toThrow();
});


it('objetos de valor comparam conteúdo e não identidade de referência', () => {
  expect(new Money(100).equals(new Money(100))).toBe(true);
  expect(new Money(100).equals(new Money(101))).toBe(false);
  expect(new Quantity(2).equals(new Quantity(2))).toBe(true);
  expect(new StockBalance(0).equals(new StockBalance(0))).toBe(true);
  expect(new TaxDocument('529.982.247-25').equals(new TaxDocument('52998224725'))).toBe(true);
  expect(new VehiclePlate('ABC-1234').equals(new VehiclePlate('ABC1234'))).toBe(true);
  const code = TrackingCode.generate();
  expect(code.equals(new TrackingCode(code.value))).toBe(true);
  const order = WorkOrder.create(1, 2, 'Revisão preventiva', [new WorkOrderItem(undefined, ItemKind.Service, 1, 'Revisão', new Quantity(1), new Money(100))]);
  expect(order.quotation.equals(new Quote(new Money(100), order.quoteVersion))).toBe(true);
});

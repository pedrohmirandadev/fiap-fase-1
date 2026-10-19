import { DomainError, DomainErrorKind } from '../shared/domain-error';
import { DomainEvent, DomainEventName, AggregateType } from '../shared/domain-event';
import { Money, TrackingCode } from '../shared/value-objects';
import { WorkOrderStatus } from './status';
import { WorkOrderItem, ItemKind } from './work-order-item';
import { QuoteDecision } from './quote-decision';
import { StatusChange } from './status-change';
import { QuoteVersion } from './quote-version';
import { Quote } from './quote';

/** Raiz do agregado: itens, decisões e histórico só mudam por ações da OS. */
export class WorkOrder {
  readonly items: readonly WorkOrderItem[];
  readonly decisions: readonly QuoteDecision[];
  readonly history: readonly StatusChange[];
  readonly pendingEvents: readonly DomainEvent[];

  constructor(readonly id: number | undefined, readonly customerId: number, readonly vehicleId: number,
    readonly complaint: string, readonly trackingCode: TrackingCode, readonly status: WorkOrderStatus,
    items: readonly WorkOrderItem[] = [], decisions: readonly QuoteDecision[] = [],
    history: readonly StatusChange[] = [], readonly quoteVersion: QuoteVersion = new QuoteVersion(),
    pendingEvents: readonly DomainEvent[] = []) {
    if (!Number.isSafeInteger(customerId) || customerId <= 0 || !Number.isSafeInteger(vehicleId) || vehicleId <= 0 || complaint.trim().length < 3) throw new DomainError('Ordem de serviço inválida');
    this.items = Object.freeze([...items]);
    this.decisions = Object.freeze([...decisions]);
    this.history = Object.freeze([...history]);
    this.pendingEvents = Object.freeze([...pendingEvents]);
    Object.freeze(this);
  }

  static create(customerId: number, vehicleId: number, complaint: string, items: WorkOrderItem[]): WorkOrder {
    if (!items.length) throw new DomainError('A OS deve conter ao menos um serviço ou peça');
    const code = TrackingCode.generate();
    const total = Quote.calculate(items, new QuoteVersion());
    return new WorkOrder(undefined, customerId, vehicleId, complaint.trim(), code, WorkOrderStatus.Received, items, [],
      [new StatusChange(null, WorkOrderStatus.Received, 'OS criada')], total.version, [
        new DomainEvent(DomainEventName.WorkOrderReceived, AggregateType.WorkOrder, code.value, { customerId, vehicleId }),
        new DomainEvent(DomainEventName.QuoteCalculated, AggregateType.WorkOrder, code.value, { totalCents: total.total.cents, quoteVersion: 1 })
      ]);
  }

  get quotation(): Quote { return Quote.calculate(this.items, this.quoteVersion); }
  get quote(): Money { return this.quotation.total; }

  private requireStatus(status: WorkOrderStatus): void {
    if (this.status !== status) throw new DomainError(`Ação exige ${status}; OS está em ${this.status}`, DomainErrorKind.Conflict);
  }

  private event(name: DomainEventName, payload: Record<string, string | number | boolean> = {}): DomainEvent {
    return new DomainEvent(name, AggregateType.WorkOrder, this.trackingCode.value,
      { quoteVersion: this.quoteVersion.value, ...payload });
  }

  private changeStatus(target: WorkOrderStatus, note: string | undefined, events: DomainEvent[]): WorkOrder {
    return new WorkOrder(this.id, this.customerId, this.vehicleId, this.complaint, this.trackingCode,
      target, this.items, this.decisions, [...this.history, new StatusChange(this.status, target, note)],
      this.quoteVersion, [...this.pendingEvents, ...events]);
  }

  startDiagnosis(note?: string): WorkOrder {
    this.requireStatus(WorkOrderStatus.Received);
    return this.changeStatus(WorkOrderStatus.Diagnosis, note, [this.event(DomainEventName.DiagnosisStarted)]);
  }

  submitQuote(note?: string): WorkOrder {
    this.requireStatus(WorkOrderStatus.Diagnosis);
    if (!this.items.length) throw new DomainError('Não é possível apresentar orçamento vazio');
    return this.changeStatus(WorkOrderStatus.AwaitingApproval, note, [this.event(DomainEventName.QuoteSubmitted, { totalCents: this.quote.cents })]);
  }

  approveQuote(expectedVersion: QuoteVersion = this.quoteVersion, reason?: string): WorkOrder {
    this.requireStatus(WorkOrderStatus.AwaitingApproval);
    this.ensureCurrentQuote(expectedVersion);
    const resumed = this.history.some(change => change.to === WorkOrderStatus.InProgress);
    const decision = new QuoteDecision(true, this.quote, reason, new Date(), this.quoteVersion);
    const items = this.items.map(item => item.kind === ItemKind.Part && !item.consumed ? item.markConsumed() : item);
    return new WorkOrder(this.id, this.customerId, this.vehicleId, this.complaint, this.trackingCode, WorkOrderStatus.InProgress,
      items, [...this.decisions, decision], [...this.history, new StatusChange(this.status, WorkOrderStatus.InProgress, 'Orçamento aprovado pelo cliente')],
      this.quoteVersion, [...this.pendingEvents, this.event(DomainEventName.QuoteApproved, { totalCents: this.quote.cents }),
        this.event(resumed ? DomainEventName.ExecutionResumed : DomainEventName.ExecutionStarted)]);
  }

  rejectQuote(expectedVersion: QuoteVersion = this.quoteVersion, reason?: string): WorkOrder {
    this.requireStatus(WorkOrderStatus.AwaitingApproval);
    this.ensureCurrentQuote(expectedVersion);
    return new WorkOrder(this.id, this.customerId, this.vehicleId, this.complaint, this.trackingCode, this.status,
      this.items, [...this.decisions, new QuoteDecision(false, this.quote, reason, new Date(), this.quoteVersion)],
      this.history, this.quoteVersion, [...this.pendingEvents, this.event(DomainEventName.QuoteRejected, { totalCents: this.quote.cents })]);
  }

  private ensureCurrentQuote(version: QuoteVersion): void {
    if (!this.quoteVersion.equals(version)) throw new DomainError('Orçamento alterado; consulte a versão atual antes de decidir', DomainErrorKind.Conflict);
  }

  proposeAdditionalRepair(item: WorkOrderItem): WorkOrder {
    this.requireStatus(WorkOrderStatus.InProgress);
    const version = this.quoteVersion.next();
    const items = [...this.items, item];
    const total = Quote.calculate(items, version).total;
    return new WorkOrder(this.id, this.customerId, this.vehicleId, this.complaint, this.trackingCode, WorkOrderStatus.AwaitingApproval,
      items, this.decisions, [...this.history, new StatusChange(this.status, WorkOrderStatus.AwaitingApproval, 'Reparo adicional proposto; aguardando nova aprovação')],
      version, [...this.pendingEvents,
        this.event(DomainEventName.AdditionalRepairProposed, { catalogId: item.catalogId, kind: item.kind, quoteVersion: version.value }),
        this.event(DomainEventName.ExecutionPaused, { quoteVersion: version.value }),
        this.event(DomainEventName.QuoteRevised, { totalCents: total.cents, quoteVersion: version.value }),
        this.event(DomainEventName.QuoteSubmitted, { totalCents: total.cents, quoteVersion: version.value })]);
  }

  finishRepair(note?: string): WorkOrder {
    this.requireStatus(WorkOrderStatus.InProgress);
    return this.changeStatus(WorkOrderStatus.Finished, note, [this.event(DomainEventName.RepairFinished)]);
  }

  recordDelivery(note?: string): WorkOrder {
    this.requireStatus(WorkOrderStatus.Finished);
    return this.changeStatus(WorkOrderStatus.Delivered, note, [this.event(DomainEventName.VehicleDelivered)]);
  }
}

import { randomUUID } from 'node:crypto';

export enum DomainEventName {
  WorkOrderReceived = 'WorkOrderReceived',
  QuoteCalculated = 'QuoteCalculated',
  DiagnosisStarted = 'DiagnosisStarted',
  QuoteSubmitted = 'QuoteSubmitted',
  QuoteApproved = 'QuoteApproved',
  QuoteRejected = 'QuoteRejected',
  ExecutionStarted = 'ExecutionStarted',
  ExecutionResumed = 'ExecutionResumed',
  AdditionalRepairProposed = 'AdditionalRepairProposed',
  ExecutionPaused = 'ExecutionPaused',
  QuoteRevised = 'QuoteRevised',
  RepairFinished = 'RepairFinished',
  VehicleDelivered = 'VehicleDelivered',
  StockReceived = 'StockReceived',
  StockWithdrawn = 'StockWithdrawn',
  PartsConsumed = 'PartsConsumed',
  MinimumStockReached = 'MinimumStockReached'
}

export enum AggregateType {
  WorkOrder = 'WorkOrder',
  Part = 'Part'
}

/** Fato já aceito pelo domínio. O armazenamento ocorre na mesma transação da mudança. */
export class DomainEvent {
  readonly id = randomUUID();
  readonly occurredAt = new Date();
  readonly payload: Readonly<Record<string, string | number | boolean>>;

  constructor(readonly name: DomainEventName, readonly aggregateType: AggregateType,
    readonly aggregateId: string, payload: Record<string, string | number | boolean>) {
    this.payload = Object.freeze({ ...payload });
    Object.freeze(this);
  }
}

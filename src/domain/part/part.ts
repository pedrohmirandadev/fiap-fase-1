import { DomainError, DomainErrorKind } from '../shared/domain-error';
import { Money, Quantity } from '../shared/value-objects';
import { StockBalance } from '../shared/stock-balance';
import { DomainEvent, DomainEventName, AggregateType } from '../shared/domain-event';
import { InventoryMovement } from './inventory-movement';

export class Part {
  readonly stockBalance: StockBalance;
  get stockQuantity(): number { return this.stockBalance.value; }
  constructor(readonly id: number | undefined, readonly sku: string, readonly name: string,
    readonly description: string | undefined, readonly price: Money, stockQuantity: number,
    readonly minimumStock: number, readonly active: boolean = true, readonly version: number = 0) {
    if (!sku.trim() || !name.trim() || !Number.isSafeInteger(stockQuantity) || stockQuantity < 0 ||
      !Number.isSafeInteger(minimumStock) || minimumStock < 0) throw new DomainError('Peça ou saldo inválido');
    this.stockBalance = new StockBalance(stockQuantity);
    Object.freeze(this);
  }
  static create(input: { sku: string; name: string; description?: string; priceCents: number; stockQuantity?: number; minimumStock?: number }): Part {
    return new Part(undefined, input.sku.trim(), input.name.trim(), input.description, new Money(input.priceCents), input.stockQuantity ?? 0, input.minimumStock ?? 0);
  }
  rename(name: string): Part {
    return new Part(this.id, this.sku, name.trim(), this.description, this.price, this.stockQuantity, this.minimumStock, this.active, this.version);
  }
  changeDescription(description: string): Part {
    return new Part(this.id, this.sku, this.name, description, this.price, this.stockQuantity, this.minimumStock, this.active, this.version);
  }
  changePrice(price: Money): Part {
    return new Part(this.id, this.sku, this.name, this.description, price, this.stockQuantity, this.minimumStock, this.active, this.version);
  }
  changeMinimumStock(minimumStock: number): Part {
    return new Part(this.id, this.sku, this.name, this.description, this.price, this.stockQuantity, minimumStock, this.active, this.version);
  }
  activate(): Part {
    return new Part(this.id, this.sku, this.name, this.description, this.price, this.stockQuantity, this.minimumStock, true, this.version);
  }
  deactivate(): Part {
    return new Part(this.id, this.sku, this.name, this.description, this.price, this.stockQuantity, this.minimumStock, false, this.version);
  }
  receiveStock(quantity: number): Part {
    if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new DomainError('Quantidade da movimentação inválida');
    return new Part(this.id, this.sku, this.name, this.description, this.price, this.stockBalance.receive(new Quantity(quantity)).value, this.minimumStock, this.active, this.version);
  }
  withdrawStock(quantity: number): Part {
    if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new DomainError('Quantidade da movimentação inválida');
    if (this.stockQuantity < quantity) throw new DomainError('Estoque não pode ficar negativo', DomainErrorKind.Conflict);
    return new Part(this.id, this.sku, this.name, this.description, this.price, this.stockBalance.withdraw(new Quantity(quantity)).value, this.minimumStock, this.active, this.version);
  }
  recordReceipt(quantity: Quantity, reason: string): StockChange {
    return this.stockChange(this.receiveStock(quantity.value), quantity.value, reason);
  }
  recordWithdrawal(quantity: Quantity, reason: string): StockChange {
    return this.stockChange(this.withdrawStock(quantity.value), -quantity.value, reason);
  }
  consumeForWorkOrder(quantity: Quantity, workOrderId: number): StockChange {
    this.ensureAvailable(quantity.value);
    return this.stockChange(this.withdrawStock(quantity.value), -quantity.value, 'Consumo na OS', workOrderId);
  }
  private stockChange(part: Part, delta: number, reason: string, workOrderId?: number): StockChange {
    if (!this.id) throw new DomainError('Peça deve estar cadastrada antes de movimentar estoque');
    const movement = new InventoryMovement(undefined, this.id, delta, reason, workOrderId);
    const events = [new DomainEvent(workOrderId ? DomainEventName.PartsConsumed : delta > 0 ? DomainEventName.StockReceived : DomainEventName.StockWithdrawn,
      AggregateType.Part, String(this.id), { quantityDelta: delta, balance: part.stockQuantity, ...(workOrderId ? { workOrderId } : {}) })];
    if (this.stockQuantity > this.minimumStock && part.stockQuantity <= part.minimumStock) {
      events.push(new DomainEvent(DomainEventName.MinimumStockReached, AggregateType.Part, String(this.id), { balance: part.stockQuantity, minimumStock: part.minimumStock }));
    }
    return { part, movement, events };
  }
  ensureAvailable(quantity: number): void {
    const requested = new Quantity(quantity);
    if (!this.active || this.stockQuantity < requested.value) throw new DomainError('Estoque insuficiente ou peça indisponível', DomainErrorKind.Conflict);
  }
}

export interface StockChange { readonly part: Part; readonly movement: InventoryMovement; readonly events: readonly DomainEvent[] }

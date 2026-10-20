import { DomainError, DomainErrorKind } from './domain-error';
import { Quantity } from './value-objects';

export class StockBalance {
  constructor(readonly value: number) {
    if (!Number.isSafeInteger(value) || value < 0) throw new DomainError('Saldo de estoque inválido');
    Object.freeze(this);
  }
  receive(quantity: Quantity): StockBalance { return new StockBalance(this.value + quantity.value); }
  withdraw(quantity: Quantity): StockBalance {
    if (quantity.value > this.value) throw new DomainError('Estoque não pode ficar negativo', DomainErrorKind.Conflict);
    return new StockBalance(this.value - quantity.value);
  }
  equals(other: StockBalance): boolean { return this.value === other.value; }
}

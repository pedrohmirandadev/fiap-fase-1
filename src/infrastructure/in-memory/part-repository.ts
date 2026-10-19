import { ApplicationError, ErrorKind } from '../../application/errors';
import { InventoryMovement } from '../../domain/part/inventory-movement';
import { Part } from '../../domain/part/part';
import type { PartRepository } from '../../domain/part/part-repository';
import { nextId, type StateSession } from './state';

export class InMemoryPartRepository implements PartRepository {
  constructor(private readonly session: StateSession) {}
  async findById(id: number, _lock = false) { return this.session.state.parts.get(id); }
  async findAll() { return [...this.session.state.parts.values()].sort((a, b) => a.id! - b.id!); }
  async save(part: Part) {
    const state = this.session.state;
    if ([...state.parts.values()].some(existing => existing.id !== part.id && existing.sku === part.sku)) {
      throw new ApplicationError(ErrorKind.Conflict, 'Peça com este SKU já existe');
    }
    if (part.id !== undefined && state.parts.get(part.id)?.version !== part.version) {
      throw new ApplicationError(ErrorKind.Conflict, 'Peça alterada por outra operação; tente novamente');
    }
    const saved = new Part(part.id ?? nextId(state, 'part'), part.sku, part.name, part.description, part.price, part.stockQuantity, part.minimumStock, part.active, part.id === undefined ? 0 : part.version + 1);
    state.parts.set(saved.id!, saved);
    return saved;
  }
  async recordMovement(movement: InventoryMovement) {
    const state = this.session.state;
    if (!state.parts.has(movement.partId)) throw new ApplicationError(ErrorKind.Conflict, 'Peça não encontrada');
    const saved = new InventoryMovement(nextId(state, 'movement'), movement.partId, movement.quantityDelta, movement.reason, movement.workOrderId, movement.createdAt);
    state.movements.push(saved);
  }
  async movements(id: number) { return this.session.state.movements.filter(movement => movement.partId === id).sort((a, b) => b.id! - a.id!); }
}

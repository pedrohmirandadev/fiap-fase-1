import { ApplicationError, ErrorKind } from '../../application/errors';
import { Workshop } from '../../domain/workshop/workshop';
import type { WorkshopRepository } from '../../domain/workshop/workshop-repository';
import { nextId, type StateSession } from './state';

export class InMemoryWorkshopRepository implements WorkshopRepository {
  constructor(private readonly session: StateSession) {}
  async findById(id: number) { return this.session.state.workshops.get(id); }
  async save(workshop: Workshop) {
    const state = this.session.state;
    if ([...state.workshops.values()].some(existing => existing.id !== workshop.id && existing.document.value === workshop.document.value)) {
      throw new ApplicationError(ErrorKind.Conflict, 'Oficina com este CPF/CNPJ já existe');
    }
    const saved = new Workshop(workshop.id ?? nextId(state, 'workshop'), workshop.name, workshop.document, workshop.address, workshop.phone);
    state.workshops.set(saved.id!, saved);
    return saved;
  }
}

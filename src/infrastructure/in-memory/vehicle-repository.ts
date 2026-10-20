import { ApplicationError, ErrorKind } from '../../application/errors';
import { Vehicle } from '../../domain/vehicle/vehicle';
import type { VehicleRepository } from '../../domain/vehicle/vehicle-repository';
import { nextId, type StateSession } from './state';
import { cascadeDeleteVehicle } from './cascade-deletion';

export class InMemoryVehicleRepository implements VehicleRepository {
  constructor(private readonly session: StateSession) {}
  async findById(id: number) { return this.session.state.vehicles.get(id); }
  async findAll() { return [...this.session.state.vehicles.values()].sort((a, b) => a.id! - b.id!); }
  async save(vehicle: Vehicle) {
    const state = this.session.state;
    if (!state.customers.has(vehicle.customerId)) throw new ApplicationError(ErrorKind.Conflict, 'Cliente não encontrado');
    if ([...state.vehicles.values()].some(existing => existing.id !== vehicle.id && existing.plate.value === vehicle.plate.value)) {
      throw new ApplicationError(ErrorKind.Conflict, 'Veículo com esta placa já existe');
    }
    const saved = new Vehicle(vehicle.id ?? nextId(state, 'vehicle'), vehicle.customerId, vehicle.plate, vehicle.brand, vehicle.model, vehicle.year);
    state.vehicles.set(saved.id!, saved);
    return saved;
  }
  async delete(id: number) {
    return cascadeDeleteVehicle(this.session.state, id);
  }
}

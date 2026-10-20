import { ApplicationError, ErrorKind } from '../../application/errors';
import { Customer } from '../../domain/customer/customer';
import type { CustomerRepository } from '../../domain/customer/customer-repository';
import { nextId, type StateSession } from './state';
import { cascadeDeleteVehicle, cascadeDeleteWorkOrder } from './cascade-deletion';

export class InMemoryCustomerRepository implements CustomerRepository {
  constructor(private readonly session: StateSession) {}
  async findById(id: number) { return this.session.state.customers.get(id); }
  async findByDocument(document: string) { return [...this.session.state.customers.values()].find(customer => customer.document.value === document); }
  async findAll(limit: number, offset: number) { return [...this.session.state.customers.values()].sort((a, b) => a.id! - b.id!).slice(offset, offset + limit); }
  async save(customer: Customer) {
    const state = this.session.state;
    if ([...state.customers.values()].some(existing => existing.id !== customer.id && existing.document.value === customer.document.value)) {
      throw new ApplicationError(ErrorKind.Conflict, 'Cliente com este CPF/CNPJ já existe');
    }
    const saved = new Customer(customer.id ?? nextId(state, 'customer'), customer.name, customer.document, customer.email, customer.phone);
    state.customers.set(saved.id!, saved);
    return saved;
  }
  async delete(id: number) {
    const state = this.session.state;
    if (!state.customers.has(id)) return false;
    for (const [vehicleId, vehicle] of state.vehicles) {
      if (vehicle.customerId === id) cascadeDeleteVehicle(state, vehicleId);
    }
    for (const [orderId, record] of state.workOrders) {
      if (record.order.customerId === id) cascadeDeleteWorkOrder(state, orderId);
    }
    return state.customers.delete(id);
  }
}

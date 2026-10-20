import { describe, expect, it } from 'bun:test';
import { InMemoryStore, LiveSession, SnapshotSession, copyState, nextId } from '../src/infrastructure/in-memory/state';
import { createRelatedFixtures } from './factories';

describe('Estado e sessões da persistência em memória', () => {
  it('inicia todos os módulos vazios e mantém stores independentes', () => {
    const first = new InMemoryStore(), second = new InMemoryStore();
    for (const name of ['customers', 'vehicles', 'services', 'parts', 'workshops', 'users', 'workOrders'] as const) {
      expect(first.state[name].size).toBe(0);
      expect(first.state[name]).not.toBe(second.state[name]);
    }
    expect(first.state.movements).toEqual([]);
    expect(first.state.events).toEqual([]);
    for (const kind of Object.keys(first.state.nextIds) as Array<keyof typeof first.state.nextIds>) {
      expect(nextId(first.state, kind)).toBe(1);
      expect(nextId(first.state, kind)).toBe(2);
      expect(second.state.nextIds[kind]).toBe(1);
    }
  });

  it('copia os contêineres, conserva entidades imutáveis e isola mutações do snapshot', () => {
    const store = new InMemoryStore(), f = createRelatedFixtures();
    store.state.customers.set(f.customer.id!, f.customer);
    store.state.vehicles.set(f.vehicle.id!, f.vehicle);
    store.state.services.set(f.service.id!, f.service);
    store.state.parts.set(f.part.id!, f.part);
    store.state.workshops.set(f.workshop.id!, f.workshop);
    store.addAdminUser(f.adminUser);
    store.state.workOrders.set(f.workOrder.id!, { order: f.workOrder, quoteTotalCents: f.workOrder.quote.cents,
      openedAt: new Date(), updatedAt: new Date() });
    store.state.movements.push(f.inventoryMovement);
    const copy = copyState(store.state);
    for (const name of ['customers', 'vehicles', 'services', 'parts', 'workshops', 'users', 'workOrders'] as const) {
      expect([...copy[name].values()]).toEqual([...store.state[name].values()]);
      expect(copy[name]).not.toBe(store.state[name]);
      copy[name].clear();
      expect(store.state[name].size).toBe(1);
    }
    expect(copy.movements[0]).toBe(f.inventoryMovement);
    copy.movements.pop();
    expect(store.state.movements).toEqual([f.inventoryMovement]);
    expect(copy.events).not.toBe(store.state.events);
    nextId(copy, 'customer');
    expect(store.state.nextIds.customer).toBe(1);
  });

  it('sessão live acompanha commits enquanto snapshot mantém a visão isolada', () => {
    const store = new InMemoryStore(), live = new LiveSession(store);
    const snapshot = new SnapshotSession(copyState(store.state));
    const committed = copyState(store.state), f = createRelatedFixtures();
    committed.customers.set(f.customer.id!, f.customer);
    store.state = committed;
    expect(live.state).toBe(committed);
    expect(live.state.customers.get(f.customer.id!)).toBe(f.customer);
    expect(snapshot.state.customers.size).toBe(0);
    expect(snapshot.state).not.toBe(live.state);
  });
});

import { describe, expect, it, mock } from 'bun:test';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { PostgresDao, type SqlConnection } from '../src/infrastructure/database/postgres-dao';
import { PgUnitOfWork } from '../src/infrastructure/database/pg-unit-of-work';
import * as schema from '../src/infrastructure/database/schema';
import { createMockEnvironment } from './mocks';
import { createEntityFactories, createRelatedFixtures, FIXTURE_ADMIN_PASSWORD } from './factories';
import { compare } from 'bcryptjs';
import { Customer } from '../src/domain/customer/customer';

class ExampleDao extends PostgresDao {
  query = this.rows<{ value: string }>;
  one = this.first<{ value: string }>;
}

describe('DAO e unidade de trabalho PostgreSQL', () => {
  it('parametriza SQL, serializa datas e preserva valores nulos, zero e false', async () => {
    const unsafe = mock(async (_statement: string, _parameters: unknown[]) => [{ value: 'ok' }]);
    const dao = new ExampleDao({ unsafe } as unknown as SqlConnection);
    const date = new Date('2026-01-01T00:00:00Z'), hostile = "'; DROP TABLE users; --";
    expect(await dao.query('SELECT $1, $2, $3, $4, $5', [date, hostile, 0, false, null])).toEqual([{ value: 'ok' }]);
    expect(unsafe).toHaveBeenCalledWith('SELECT $1, $2, $3, $4, $5', [date.toISOString(), hostile, 0, false, null]);
    expect(await dao.one('SELECT 1')).toEqual({ value: 'ok' });
    expect(unsafe.mock.calls[1]![1]).toEqual([]);
    unsafe.mockResolvedValue([]);
    expect(await dao.one('SELECT 1 WHERE false')).toBeUndefined();
  });
  it('propaga falhas de SQL', async () => {
    const unsafe = mock(async () => { throw new Error('Falha SQL'); });
    await expect(new ExampleDao({ unsafe } as unknown as SqlConnection).query('SELECT 1')).rejects.toThrow('Falha SQL');
  });
  it.each(['begin', 'savepoint'] as const)('usa %s e entrega repositórios da mesma transação ao callback', async operation => {
    const unsafe = mock(async () => []);
    const transaction = { unsafe } as unknown as SqlConnection;
    const run = mock(async (callback: (tx: SqlConnection) => Promise<unknown>) => callback(transaction));
    const uow = new PgUnitOfWork({ [operation]: run } as unknown as SqlConnection);
    expect(await uow.run(async repos => { expect(await repos.customers.findById(1)).toBeUndefined(); return 42; })).toBe(42);
    expect(run).toHaveBeenCalledTimes(1);
    expect(unsafe).toHaveBeenCalledTimes(1);
    await expect(uow.run(async () => { throw new Error('Abortar'); })).rejects.toThrow('Abortar');
  });
});

describe('Metadados relacionais do Drizzle', () => {
  it('define as tabelas, os estados e as mesmas políticas de cascata das migrações', () => {
    expect(schema.osStatus.enumValues).toEqual(['RECEIVED','DIAGNOSIS','AWAITING_APPROVAL','IN_PROGRESS','FINISHED','DELIVERED']);
    for (const table of [schema.users, schema.workshops, schema.customers, schema.vehicles, schema.services, schema.parts, schema.workOrders, schema.orderItems, schema.statusHistory, schema.quoteDecisions, schema.inventoryMovements, schema.domainEvents]) {
      const config = getTableConfig(table);
      expect(config.columns.some(column => column.primary)).toBe(true);
      expect(config.name).toBeTruthy();
    }
    const actions = (table: Parameters<typeof getTableConfig>[0]) => getTableConfig(table).foreignKeys.map(key => ({ column: key.reference().columns[0]!.name, action: key.onDelete }));
    expect(actions(schema.vehicles)).toEqual([{ column: 'customer_id', action: 'cascade' }]);
    expect(actions(schema.workOrders)).toEqual([{ column: 'customer_id', action: 'cascade' }, { column: 'vehicle_id', action: 'cascade' }]);
    for (const table of [schema.orderItems, schema.statusHistory, schema.quoteDecisions]) expect(actions(table)).toContainEqual({ column: 'work_order_id', action: 'cascade' });
    expect(actions(schema.inventoryMovements)).toContainEqual({ column: 'work_order_id', action: 'set null' });
    expect(actions(schema.inventoryMovements)).toContainEqual({ column: 'part_id', action: 'no action' });
    expect(getTableConfig(schema.vehicles).indexes.map(index => index.config.name)).toEqual(['vehicles_customer_id_idx']);
    expect(getTableConfig(schema.workOrders).indexes.map(index => index.config.name)).toEqual(['work_orders_customer_id_idx', 'work_orders_vehicle_id_idx']);
    expect(getTableConfig(schema.orderItems).indexes.map(index => index.config.name)).toEqual(['order_items_work_order_id_idx', 'order_items_service_id_idx', 'order_items_part_id_idx']);
  });
});

describe('Mocks e fábricas de todos os módulos', () => {
  it('gera cada método de porta e rejeita chamadas sem configuração', async () => {
    const e = createMockEnvironment();
    const ports = [...Object.values(e.repositories), e.workOrderQueries];
    let count = 0;
    for (const port of ports) for (const [name, fn] of Object.entries(port)) {
      expect(typeof fn).toBe('function');
      // Parâmetros ausentes são intencionais: o mock padrão deve falhar antes de acessar dados.
      await expect(fn()).rejects.toThrow('Mock não configurado:');
      expect(fn.getMockName()).toContain(`.${name}`);
      count++;
    }
    expect(count).toBe(29);
  });
  it('clear mantém configuração, reset restaura padrões e ambientes não compartilham chamadas', async () => {
    const first = createMockEnvironment(), second = createMockEnvironment();
    first.repositories.customers.findById.mockResolvedValue(first.fixtures.customer);
    expect(await first.repositories.customers.findById(1)).toBe(first.fixtures.customer);
    expect(second.repositories.customers.findById).not.toHaveBeenCalled();
    first.clearMocks();
    expect(first.repositories.customers.findById).not.toHaveBeenCalled();
    expect(await first.repositories.customers.findById(1)).toBe(first.fixtures.customer);
    first.unitOfWork.run.mockRejectedValue(new Error('Substituído'));
    first.resetMocks();
    await expect(first.repositories.customers.findById(1)).rejects.toThrow('Mock não configurado');
    expect(await first.unitOfWork.run(async context => { expect(context).toBe(first.repositories); return 7; })).toBe(7);
    await expect(first.unitOfWork.run(async () => { throw new Error('Callback falhou'); })).rejects.toThrow('Callback falhou');
  });
  it('fábricas criam entidades válidas, sequências únicas, VOs e overrides independentes', async () => {
    const f = createEntityFactories(), fixtures = createRelatedFixtures(f);
    expect(fixtures.customer).toBeInstanceOf(Customer);
    expect(fixtures.vehicle.customerId).toBe(fixtures.customer.id!);
    expect(fixtures.workOrder.vehicleId).toBe(fixtures.vehicle.id!);
    expect(fixtures.workOrder.quote.cents).toBe(21500);
    expect(fixtures.workOrder.pendingEvents).toEqual([]);
    expect(fixtures.quoteDecision.total.cents).toBe(fixtures.workOrder.quote.cents);
    expect(fixtures.inventoryMovement.partId).toBe(fixtures.part.id!);
    expect(await compare(FIXTURE_ADMIN_PASSWORD, fixtures.adminUser.passwordHash)).toBe(true);
    const customers = Array.from({ length: 25 }, () => f.customer());
    expect(new Set(customers.map(x => x.id)).size).toBe(25);
    expect(new Set(customers.map(x => x.document.value)).size).toBe(25);
    expect(new Set(Array.from({ length: 25 }, () => f.vehicle().plate.value)).size).toBe(25);
    expect(new Set(Array.from({ length: 25 }, () => f.workshop().document.value)).size).toBe(25);
    expect(f.customer({ id: undefined, name: 'Outro nome' })).toMatchObject({ id: undefined, name: 'Outro nome' });
    expect(f.part({ stockQuantity: 0, active: false })).toMatchObject({ stockQuantity: 0, active: false });
    expect(createEntityFactories().customer().id).toBe(createEntityFactories().customer().id);
    expect(fixtures.workOrder.items).toHaveLength(2);
    expect(fixtures.statusChange).toBe(fixtures.workOrder.history[0]!);
  });
});

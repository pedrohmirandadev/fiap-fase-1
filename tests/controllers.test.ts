import { describe, expect, it, spyOn } from 'bun:test';
import { Elysia } from 'elysia';
import { jwt } from '@elysia/jwt';
import { createHttpEnvironment } from './support/http-environment';
import { createApp } from '../src/presentation/app';
import { createUseCases } from '../src/composition';
import { createMockEnvironment } from './mocks';
import { ApplicationError, ErrorKind } from '../src/application/errors';
import { DomainError, DomainErrorKind } from '../src/domain/shared/domain-error';
import { WorkOrderStatus as Status } from '../src/domain/work-order/status';
import { ItemKind } from '../src/domain/work-order/work-order-item';
import { FIXTURE_ADMIN_PASSWORD } from './factories';
import * as views from '../src/presentation/presenters';

describe('Controllers HTTP com aplicação real e persistência em memória', () => {
  it('autentica com JWT real, rejeita credenciais e protege todas as rotas administrativas', async () => {
    const h = await createHttpEnvironment();
    const auth = await h.request('POST', '/api/v1/auth/login', { email: h.admin.email, password: FIXTURE_ADMIN_PASSWORD });
    expect(await auth.json()).toMatchObject({ tokenType: 'Bearer', expiresIn: '2h', token: expect.any(String) });
    await h.json('POST', '/auth/login', { email: h.admin.email, password: 'senha-errada' }, 401, false);
    await h.json('POST', '/auth/login', { email: 'ausente@example.test', password: FIXTURE_ADMIN_PASSWORD }, 401, false);
    await h.json('POST', '/auth/login', { email: 'invalid', password: 'short' }, 422, false);
    expect((await h.request('GET', '/api/v1/auth/login')).status).toBe(404);
    for (const path of ['/customers', '/vehicles', '/services', '/parts', '/workshops/1', '/work-orders', '/metrics/average-execution-time']) {
      expect((await h.request('GET', `/api/v1${path}`)).status).toBe(401);
      expect((await h.request('GET', `/api/v1${path}`, undefined, 'invalid')).status).toBe(401);
    }
    const signer = new Elysia().use(jwt({ name: 'jwt', secret: 'isolated-test-secret-12345678901234567890' }))
      .get('/expired', ({ jwt }) => jwt.sign({ sub: '1', exp: 1 }))
      .get('/no-subject', ({ jwt }) => jwt.sign({ email: h.admin.email }));
    const expired = await (await signer.handle(new Request('http://localhost/expired'))).text();
    const noSubject = await (await signer.handle(new Request('http://localhost/no-subject'))).text();
    for (const token of [expired, noSubject]) expect((await h.request('GET', '/api/v1/customers', undefined, token)).status).toBe(401);
  });

  it('clientes e veículos: CRUD, apresentação, relacionamento, validação e cascata', async () => {
    const h = await createHttpEnvironment(), j = h.json;
    const customer = await j('POST', '/customers', { name: 'Cliente HTTP', document: '529.982.247-25' }, 201);
    expect(customer).toMatchObject({ name: 'Cliente HTTP', document: '52998224725', email: null, phone: null });
    expect(await j('GET', '/customers?limit=1&offset=0')).toHaveLength(1);
    expect(await j('GET', `/customers/${customer.id}`)).toEqual(customer);
    expect(await j('PATCH', `/customers/${customer.id}`, { name: 'Nome novo', email: 'novo@example.test', phone: '11999' })).toMatchObject({ name: 'Nome novo', email: 'novo@example.test', phone: '11999' });
    await j('POST', '/customers', { name: 'Duplicado', document: customer.document }, 409);
    await j('POST', '/customers', { name: 'Invalido', document: '123' }, 422);
    const payload = { customerId: customer.id, plate: 'ABC1D23', brand: 'Honda', model: 'Civic', year: 2020 };
    const vehicle = await j('POST', '/vehicles', payload, 201);
    expect(await j('GET', '/vehicles')).toEqual([vehicle]);
    expect(await j('GET', `/vehicles/${vehicle.id}`)).toEqual(vehicle);
    expect(await j('PATCH', `/vehicles/${vehicle.id}`, { brand: 'Ford', model: 'Ka', year: 2021 })).toMatchObject({ brand: 'Ford', model: 'Ka', year: 2021 });
    await j('POST', '/vehicles', payload, 409);
    await j('POST', '/vehicles', { ...payload, customerId: 99999 }, 404);
    await j('POST', '/vehicles', { ...payload, year: 1949 }, 422);
    await j('DELETE', `/vehicles/${vehicle.id}`);
    await j('GET', `/vehicles/${vehicle.id}`, undefined, 404);
    await j('DELETE', `/vehicles/${vehicle.id}`, undefined, 404);
    const other = await j('POST', '/vehicles', { ...payload, plate: 'XYZ9A88' }, 201);
    await j('DELETE', `/customers/${customer.id}`);
    await j('GET', `/vehicles/${other.id}`, undefined, 404);
    await j('GET', `/customers/${customer.id}`, undefined, 404);
    await j('DELETE', `/customers/${customer.id}`, undefined, 404);
    await j('PATCH', '/customers/99999', {}, 404);
    await j('PATCH', '/vehicles/99999', {}, 404);
  });

  it('catálogo e oficina: cria, atualiza, consulta, desativa e movimenta estoque', async () => {
    const h = await createHttpEnvironment(), j = h.json;
    const service = await j('POST', '/services', { name: 'Revisão', priceCents: 10000, estimatedMinutes: 60 }, 201);
    expect(service.description).toBeNull();
    expect(await j('GET', `/services/${service.id}`)).toEqual(service);
    expect(await j('GET', '/services')).toEqual([service]);
    expect(await j('PATCH', `/services/${service.id}`, { name: 'Óleo', description: 'Troca', priceCents: 0, estimatedMinutes: 1, active: false })).toMatchObject({ priceCents: 0, active: false, description: 'Troca' });
    await j('PATCH', `/services/${service.id}`, { active: true });
    await j('DELETE', `/services/${service.id}`);
    expect((await j('GET', `/services/${service.id}`)).active).toBe(false);
    const part = await j('POST', '/parts', { sku: 'HTTP-1', name: 'Filtro', priceCents: 2000, stockQuantity: 3, minimumStock: 2 }, 201);
    expect(part.description).toBeNull();
    expect(await j('GET', '/parts')).toEqual([part]);
    expect(await j('GET', `/parts/${part.id}`)).toEqual(part);
    expect(await j('PATCH', `/parts/${part.id}`, { name: 'Filtro novo', description: 'Original', priceCents: 0, minimumStock: 0, active: false })).toMatchObject({ priceCents: 0, minimumStock: 0, active: false });
    await j('PATCH', `/parts/${part.id}`, { active: true });
    expect(await j('POST', `/parts/${part.id}/movements`, { quantityDelta: 2, reason: 'Compra' })).toMatchObject({ stockQuantity: 5 });
    expect(await j('POST', `/parts/${part.id}/movements`, { quantityDelta: -5, reason: 'Retirada' })).toMatchObject({ stockQuantity: 0 });
    const movements = await j('GET', `/parts/${part.id}/movements`);
    expect(movements.map((m: { quantity_delta: number }) => m.quantity_delta)).toEqual([-5, 2]);
    expect(movements[0].work_order_id).toBeNull();
    await j('POST', `/parts/${part.id}/movements`, { quantityDelta: -1, reason: 'Retirada' }, 409);
    await j('POST', `/parts/${part.id}/movements`, { quantityDelta: 0, reason: 'Inválido' }, 422);
    await j('POST', '/parts', { sku: 'HTTP-1', name: 'Duplicada', priceCents: 1 }, 409);
    await j('DELETE', `/parts/${part.id}`);
    expect((await j('GET', `/parts/${part.id}`)).active).toBe(false);
    const workshop = await j('POST', '/workshops', { name: 'Oficina HTTP', document: '11222333000181', address: 'Rua A, 10' }, 201);
    expect(workshop.phone).toBeNull();
    expect(await j('GET', `/workshops/${workshop.id}`)).toEqual(workshop);
    for (const path of ['/services/99999', '/parts/99999', '/parts/99999/movements', '/workshops/99999']) await j('GET', path, undefined, 404);
    for (const path of ['/services/99999', '/parts/99999']) { await j('PATCH', path, {}, 404); await j('DELETE', path, undefined, 404); }
  });

  it('OS: fluxo completo com rejeição, aprovação, reparo adicional, histórico e consulta pública', async () => {
    const h = await createHttpEnvironment(), j = h.json;
    const customer = await j('POST', '/customers', { name: 'Cliente OS', document: '52998224725' }, 201);
    const vehicle = await j('POST', '/vehicles', { customerId: customer.id, plate: 'ABC1D23', brand: 'Honda', model: 'Civic', year: 2020 }, 201);
    const service = await j('POST', '/services', { name: 'Revisão', priceCents: 10000, estimatedMinutes: 60 }, 201);
    const part = await j('POST', '/parts', { sku: 'WO-1', name: 'Filtro', priceCents: 2000, stockQuantity: 5 }, 201);
    const item = { type: ItemKind.Part, id: part.id, quantity: 1 };
    const order = await j('POST', '/work-orders', { customerDocument: customer.document, vehicleId: vehicle.id, complaint: 'Ruído no motor', items: [{ type: ItemKind.Service, id: service.id, quantity: 1 }, item] }, 201);
    expect(order).toMatchObject({ status: Status.Received, quote_total_cents: 12000, quoteVersion: 1 });
    expect(await j('GET', '/work-orders?limit=1&offset=0')).toHaveLength(1);
    expect(await j('GET', `/work-orders/${order.id}`)).toMatchObject({ id: order.id, items: expect.any(Array) });
    const publicPath = `/public/work-orders/${order.trackingCode}`;
    const view = await j('GET', publicPath, undefined, 200, false);
    expect(view).not.toHaveProperty('document');
    expect(view).not.toHaveProperty('customerId');
    await j('POST', `/work-orders/${order.id}/status`, { status: Status.InProgress }, 409);
    await j('POST', `/work-orders/${order.id}/status`, { status: Status.Diagnosis, note: 'Analisado' });
    await j('POST', `/work-orders/${order.id}/status`, { status: Status.AwaitingApproval });
    await j('POST', `${publicPath}/decision`, { approved: false, quoteVersion: 1, reason: 'Rever valor' }, 200, false);
    expect((await j('GET', `/parts/${part.id}`)).stockQuantity).toBe(5);
    await j('POST', `${publicPath}/decision`, { approved: true, quoteVersion: 1, reason: 'Aceito' }, 200, false);
    expect((await j('GET', `/parts/${part.id}`)).stockQuantity).toBe(4);
    await j('POST', `/work-orders/${order.id}/items`, item);
    await j('POST', `${publicPath}/decision`, { approved: true, quoteVersion: 1 }, 409, false);
    await j('POST', `${publicPath}/decision`, { approved: true, quoteVersion: 2 }, 200, false);
    expect((await j('GET', `/parts/${part.id}`)).stockQuantity).toBe(3);
    await j('POST', `/work-orders/${order.id}/status`, { status: Status.Finished });
    await j('POST', `/work-orders/${order.id}/status`, { status: Status.Delivered, note: 'Entregue' });
    const history = await j('GET', `/work-orders/${order.id}/history`);
    expect(history.map((x: { to_status: Status }) => x.to_status)).toEqual([Status.Received, Status.Diagnosis, Status.AwaitingApproval, Status.InProgress, Status.AwaitingApproval, Status.InProgress, Status.Finished, Status.Delivered]);
    expect(await j('GET', '/metrics/average-execution-time')).toMatchObject({ completed_orders: 1, unit: 'minutes' });
    expect(await j('GET', `/work-orders?status=${Status.Delivered}`)).toHaveLength(1);
    await j('GET', '/work-orders?status=INVALID', undefined, 422);
    await j('POST', `/work-orders/${order.id}/status`, { status: 'INVALID' }, 422);
    await j('POST', `/work-orders/${order.id}/items`, { ...item, type: 'INVALID' }, 422);
    await j('GET', '/work-orders/99999', undefined, 404);
    await j('GET', '/work-orders/99999/history', undefined, 404);
    await j('GET', '/public/work-orders/missing', undefined, 404, false);
    await j('POST', '/public/work-orders/missing/decision', { approved: true }, 404, false);
    await j('DELETE', `/customers/${customer.id}`);
    await j('GET', publicPath, undefined, 404, false);
  });

  it('saúde, CORS, OpenAPI e artefatos do Event Storming são acessíveis', async () => {
    const h = await createHttpEnvironment();
    expect(await (await h.request('GET', '/health')).json()).toEqual({ status: 'ok', database: 'connected' });
    const preflight = await h.app.handle(new Request('http://localhost/api/v1/customers', { method: 'OPTIONS', headers: { origin: 'http://client.test', 'access-control-request-method': 'POST' } }));
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-origin')).toBe('http://client.test');
    const html = await h.request('GET', '/openapi');
    expect(html.status).toBe(200);
    expect(await html.text()).toContain('scalar');
    const schema = await (await h.request('GET', '/openapi/json')).json();
    expect(schema.info.title).toBe('Oficina API');
    expect(schema.paths['/api/v1/auth/login']).toHaveProperty('post');
    expect(schema.paths['/api/v1/work-orders']).toHaveProperty('post');
    const page = await h.request('GET', '/event-storming/');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('<html');
    const catalog = await h.request('GET', '/event-storming/catalogo.json');
    expect(catalog.status).toBe(200);
    expect(await catalog.json()).toBeDefined();
    for (const path of ['/event-storming/99-inexistente.svg', '/event-storming/package.json', '/missing']) expect((await h.request('GET', path)).status).toBe(404);
  });
});

describe('Tratamento HTTP de falhas', () => {
  const cases = [
    [new ApplicationError(ErrorKind.NotFound, 'Ausente'), 404, 'Ausente'],
    [new ApplicationError(ErrorKind.Validation, 'Inválido'), 422, 'Inválido'],
    [new ApplicationError(ErrorKind.Conflict, 'Conflito'), 409, 'Conflito'],
    [new ApplicationError(ErrorKind.Unauthorized, 'Credenciais'), 401, 'Credenciais'],
    [new DomainError('Domínio inválido'), 422, 'Domínio inválido'],
    [new DomainError('Domínio conflitante', DomainErrorKind.Conflict), 409, 'Domínio conflitante'],
    [Object.assign(new Error('private db details'), { code: '23505' }), 409, 'Registro duplicado'],
    [Object.assign(new Error('private db details'), { code: '23503' }), 409, 'Registro possui dependências'],
    [new Error('segredo interno'), 500, 'Erro interno']
  ] as const;
  it.each(cases)('traduz %s para %s sem vazar detalhes', async (error, status, message) => {
    const mocks = createMockEnvironment();
    mocks.repositories.users.findByEmail.mockRejectedValue(error);
    const app = createApp({ useCases: createUseCases(mocks.repositories, mocks.unitOfWork, mocks.workOrderQueries), checkDatabase: async () => {} });
    const logger = spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = await app.handle(new Request('http://localhost/api/v1/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'user@example.test', password: 'password123' }) }));
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ error: message });
    } finally { logger.mockRestore(); }
  });
  it('saúde falha quando a dependência do banco falha', async () => {
    const mocks = createMockEnvironment();
    const app = createApp({ useCases: createUseCases(mocks.repositories, mocks.unitOfWork, mocks.workOrderQueries), checkDatabase: async () => { throw new Error('Banco fora'); } });
    const logger = spyOn(console, 'error').mockImplementation(() => {});
    try { expect((await app.handle(new Request('http://localhost/health'))).status).toBe(500); } finally { logger.mockRestore(); }
  });
});

it('presenters expõem primitivas, contatos e associações opcionais de forma explícita', () => {
  const f = createMockEnvironment().factories;
  expect(views.customerView(f.customer({ email: 'a@example.test', phone: '11' }))).toMatchObject({ email: 'a@example.test', phone: '11', document: expect.any(String) });
  expect(views.workshopView(f.workshop({ phone: '11' })).phone).toBe('11');
  expect(views.serviceView(f.service({ description: 'Descrição' })).description).toBe('Descrição');
  expect(views.partView(f.part({ description: 'Descrição' })).description).toBe('Descrição');
  expect(views.movementView(f.inventoryMovement({ workOrderId: 9 })).work_order_id).toBe(9);
});

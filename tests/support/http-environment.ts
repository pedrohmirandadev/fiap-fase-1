import { expect } from 'bun:test';
import { createApp } from '../../src/presentation/app';
import { createUseCases } from '../../src/composition';
import { createInMemoryEnvironment } from '../../src/infrastructure/in-memory/context';
import { createEntityFactories, FIXTURE_ADMIN_PASSWORD } from '../factories';
import { TEST_JWT_SECRET } from './test-secrets';

export async function createHttpEnvironment() {
  const env = createInMemoryEnvironment();
  const factories = createEntityFactories();
  const admin = factories.adminUser();
  env.store.addAdminUser(admin);
  const app = createApp({ useCases: createUseCases(env.repositories, env.unitOfWork, env.workOrderQueries),
    checkDatabase: async () => {}, jwtSecret: TEST_JWT_SECRET, corsOrigin: 'http://client.test' });
  async function request(method: string, path: string, body?: unknown, token?: string) {
    return app.handle(new Request(`http://localhost${path}`, { method,
      headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body) }));
  }
  const login = await request('POST', '/api/v1/auth/login', { email: admin.email, password: FIXTURE_ADMIN_PASSWORD });
  expect(login.status).toBe(200);
  const { token } = await login.json();
  async function json(method: string, path: string, body?: unknown, status = 200, authenticated = true) {
    const response = await request(method, `/api/v1${path}`, body, authenticated ? token : undefined);
    const result = await response.json();
    expect({ status: response.status, error: result.error }).toEqual({ status, error: status < 400 ? undefined : expect.any(String) });
    return result;
  }
  return { ...env, app, factories, request, json, token, admin };
}

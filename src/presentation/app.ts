import { Elysia, t } from 'elysia';
import { cors } from '@elysia/cors';
import { jwt } from '@elysia/jwt';
import { openapi } from '@elysia/openapi';
import type { UseCases } from '../composition';
import { ApplicationError, ErrorKind } from '../application/errors';
import { DomainError, DomainErrorKind } from '../domain/shared/domain-error';
import { createCustomerRoutes } from './routes/customer-routes';
import { createVehicleRoutes } from './routes/vehicle-routes';
import { createServiceRoutes } from './routes/service-routes';
import { createPartRoutes } from './routes/part-routes';
import { eventStormingRoutes } from './routes/event-storming-routes';
import { createWorkshopRoutes } from './routes/workshop-routes';
import { createPublicWorkOrderRoutes, createWorkOrderRoutes } from './routes/work-order-routes';

export interface AppDependencies {
  useCases: UseCases;
  checkDatabase: () => Promise<void>;
  jwtSecret?: string;
  corsOrigin?: string;
}

export function createApp(dependencies: AppDependencies) {
  const jwtSecret = dependencies.jwtSecret ?? process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters');
  }
  const adminGuard = new Elysia()
    .use(jwt({ name: 'jwt', secret: jwtSecret, exp: '2h' }))
    .derive({ as: 'global' }, async ({ headers, jwt }) => {
      const authorization = headers.authorization ?? '';
      const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
      const claims = token ? await jwt.verify(token) : false;
      return { admin: claims ? claims.sub : null };
    })
    .onBeforeHandle({ as: 'global' }, ({ admin, set }) => {
      if (!admin) { set.status = 401; return { error: 'Não autenticado' }; }
    });

  return new Elysia()
    .use(cors({
      origin: (dependencies.corsOrigin ?? process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map(value => value.trim()),
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'], credentials: false
    }))
    .use(openapi({ documentation: { info: { title: 'Oficina API', version: '1.0.0', description: 'MVP de atendimento e ordens de serviço' } } }))
    .onError({ as: 'global' }, ({ code, error, set }) => {
      if (error instanceof ApplicationError) {
        set.status = { [ErrorKind.NotFound]: 404, [ErrorKind.Validation]: 422, [ErrorKind.Conflict]: 409, [ErrorKind.Unauthorized]: 401 }[error.kind];
        return { error: error.message };
      }
      if (error instanceof DomainError) { set.status = error.kind === DomainErrorKind.Conflict ? 409 : 422; return { error: error.message }; }
      if (code === 'VALIDATION') { set.status = 422; return { error: 'Dados inválidos' }; }
      if (code === 'NOT_FOUND') { set.status = 404; return { error: 'Rota não encontrada' }; }
      const databaseCode = 'code' in error ? String(error.code) : '';
      if (databaseCode === '23505') { set.status = 409; return { error: 'Registro duplicado' }; }
      if (databaseCode === '23503') { set.status = 409; return { error: 'Registro possui dependências' }; }
      console.error('API error', code, error);
      set.status = 500;
      return { error: 'Erro interno' };
    })
    .get('/health', async () => { await dependencies.checkDatabase(); return { status: 'ok', database: 'connected' }; })
    .use(eventStormingRoutes)
    .group('/api/v1', api => api
      .use(jwt({ name: 'jwt', secret: jwtSecret, exp: '2h' }))
      .post('/auth/login', async ({ body, jwt }) => {
        const claims = await dependencies.useCases.authenticate.execute(body.email, body.password);
        return { token: await jwt.sign(claims), tokenType: 'Bearer', expiresIn: '2h' };
      }, { body: t.Object({ email: t.String({ format: 'email' }), password: t.String({ minLength: 8 }) }), detail: { summary: 'Autentica o administrador' } })
      .use(createPublicWorkOrderRoutes(dependencies.useCases))
      .use(adminGuard)
      .use(createCustomerRoutes(dependencies.useCases))
      .use(createVehicleRoutes(dependencies.useCases))
      .use(createServiceRoutes(dependencies.useCases))
      .use(createPartRoutes(dependencies.useCases))
      .use(createWorkshopRoutes(dependencies.useCases))
      .use(createWorkOrderRoutes(dependencies.useCases))
    );

}

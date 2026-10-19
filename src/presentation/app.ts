import { Elysia, t } from 'elysia';
import { cors } from '@elysia/cors';
import { jwt } from '@elysia/jwt';
import { openapi } from '@elysia/openapi';
import { sql } from 'drizzle-orm';
import { db } from '../infrastructure/database/connection';
import { useCases } from '../composition';
import { ApplicationError, ErrorKind } from '../application/errors';
import { DomainError, DomainErrorKind } from '../domain/shared/domain-error';
import { customerRoutes } from './routes/customer-routes';
import { vehicleRoutes } from './routes/vehicle-routes';
import { serviceRoutes } from './routes/service-routes';
import { partRoutes } from './routes/part-routes';
import { eventStormingRoutes } from './routes/event-storming-routes';
import { workshopRoutes } from './routes/workshop-routes';
import { publicWorkOrderRoutes, workOrderRoutes } from './routes/work-order-routes';

const jwtSecret = process.env.JWT_SECRET ?? 'local-demo-secret-change-before-sharing-123456';
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

export const app = new Elysia()
  .use(cors({
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map(value => value.trim()),
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
  .get('/health', async () => { await db.execute(sql`SELECT 1`); return { status: 'ok', database: 'connected' }; })
  .use(eventStormingRoutes)
  .group('/api/v1', api => api
    .use(jwt({ name: 'jwt', secret: jwtSecret, exp: '2h' }))
    .post('/auth/login', async ({ body, jwt }) => {
      const claims = await useCases.authenticate.execute(body.email, body.password);
      return { token: await jwt.sign(claims), tokenType: 'Bearer', expiresIn: '2h' };
    }, { body: t.Object({ email: t.String({ format: 'email' }), password: t.String({ minLength: 8 }) }), detail: { summary: 'Autentica o administrador' } })
    .use(publicWorkOrderRoutes)
    .use(adminGuard)
    .use(customerRoutes)
    .use(vehicleRoutes)
    .use(serviceRoutes)
    .use(partRoutes)
    .use(workshopRoutes)
    .use(workOrderRoutes)
  );

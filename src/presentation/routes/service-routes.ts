import { Elysia, t } from 'elysia';
import { useCases } from '../../composition';
import { serviceView } from '../presenters';

export const serviceRoutes = new Elysia()
  .get('/services', async () => (await useCases.services.list.execute()).map(serviceView))
  .get('/services/:id', async ({ params }) => serviceView(await useCases.services.get.execute(Number(params.id))))
  .post('/services', async ({ body, set }) => { set.status = 201; return serviceView(await useCases.services.create.execute(body)); }, {
    body: t.Object({ name: t.String(), description: t.Optional(t.String()), priceCents: t.Integer({ minimum: 0 }), estimatedMinutes: t.Integer({ minimum: 1 }) })
  })
  .patch('/services/:id', async ({ params, body }) => serviceView(await useCases.services.update.execute(Number(params.id), body)), {
    body: t.Object({ name: t.Optional(t.String()), description: t.Optional(t.String()), priceCents: t.Optional(t.Integer({ minimum: 0 })), estimatedMinutes: t.Optional(t.Integer({ minimum: 1 })), active: t.Optional(t.Boolean()) })
  })
  .delete('/services/:id', ({ params }) => useCases.services.deactivate.execute(Number(params.id)), {
    detail: { summary: 'Desativa serviço, preservando os itens das OS existentes' }
  });

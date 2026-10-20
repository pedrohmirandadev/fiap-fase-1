import { Elysia, t } from 'elysia';
import type { UseCases } from '../../composition';
import { movementView, partView } from '../presenters';

export const createPartRoutes = (useCases: UseCases) => new Elysia()
  .get('/parts', async () => (await useCases.parts.list.execute()).map(partView))
  .get('/parts/:id', async ({ params }) => partView(await useCases.parts.get.execute(Number(params.id))))
  .post('/parts', async ({ body, set }) => { set.status = 201; return partView(await useCases.parts.create.execute(body)); }, {
    body: t.Object({ sku: t.String(), name: t.String(), description: t.Optional(t.String()), priceCents: t.Integer({ minimum: 0 }), stockQuantity: t.Optional(t.Integer({ minimum: 0 })), minimumStock: t.Optional(t.Integer({ minimum: 0 })) })
  })
  .patch('/parts/:id', async ({ params, body }) => partView(await useCases.parts.update.execute(Number(params.id), body)), {
    body: t.Object({ name: t.Optional(t.String()), description: t.Optional(t.String()), priceCents: t.Optional(t.Integer({ minimum: 0 })), minimumStock: t.Optional(t.Integer({ minimum: 0 })), active: t.Optional(t.Boolean()) })
  })
  .delete('/parts/:id', ({ params }) => useCases.parts.deactivate.execute(Number(params.id)), {
    detail: { summary: 'Desativa peça, preservando saldo, movimentos e itens das OS existentes' }
  })
  .post('/parts/:id/movements', async ({ params, body }) => partView(await useCases.parts.adjustStock.execute(Number(params.id), body.quantityDelta, body.reason)), {
    body: t.Object({ quantityDelta: t.Integer({ minimum: -1000000, maximum: 1000000 }), reason: t.String({ minLength: 3 }) })
  })
  .get('/parts/:id/movements', async ({ params }) => (await useCases.parts.movements.execute(Number(params.id))).map(movementView));

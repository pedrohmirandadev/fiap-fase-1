import { Elysia, t } from 'elysia';
import type { UseCases } from '../../composition';
import { workshopView } from '../presenters';

export const createWorkshopRoutes = (useCases: UseCases) => new Elysia()
  .post('/workshops', async ({ body, set }) => { set.status = 201; return workshopView(await useCases.workshops.create.execute(body)); }, {
    body: t.Object({ name: t.String({ minLength: 2 }), document: t.String(), address: t.String({ minLength: 3 }), phone: t.Optional(t.String()) })
  })
  .get('/workshops/:id', async ({ params }) => workshopView(await useCases.workshops.get.execute(Number(params.id))));

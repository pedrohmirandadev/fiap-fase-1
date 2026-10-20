import { Elysia, t } from 'elysia';
import type { UseCases } from '../../composition';
import { vehicleView } from '../presenters';

export const createVehicleRoutes = (useCases: UseCases) => new Elysia()
  .get('/vehicles', async () => (await useCases.vehicles.list.execute()).map(vehicleView))
  .get('/vehicles/:id', async ({ params }) => vehicleView(await useCases.vehicles.get.execute(Number(params.id))))
  .post('/vehicles', async ({ body, set }) => { set.status = 201; return vehicleView(await useCases.vehicles.create.execute(body)); }, {
    body: t.Object({ customerId: t.Integer(), plate: t.String(), brand: t.String(), model: t.String(), year: t.Integer({ minimum: 1950, maximum: 2100 }) })
  })
  .patch('/vehicles/:id', async ({ params, body }) => vehicleView(await useCases.vehicles.update.execute(Number(params.id), body)), {
    body: t.Object({ brand: t.Optional(t.String()), model: t.Optional(t.String()), year: t.Optional(t.Integer()) })
  })
  .delete('/vehicles/:id', ({ params }) => useCases.vehicles.delete.execute(Number(params.id)), {
    detail: { summary: 'Exclui veículo e suas OS em cascata', description: 'Remove também itens, decisões e histórico das OS. Preserva cliente, catálogo, saldo, movimentos de estoque (sem vínculo à OS removida) e eventos de auditoria.' }
  });

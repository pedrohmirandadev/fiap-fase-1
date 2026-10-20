import { Elysia, t } from 'elysia';
import type { UseCases } from '../../composition';
import { customerView } from '../presenters';

export const createCustomerRoutes = (useCases: UseCases) => new Elysia()
  .get('/customers', async ({ query }) => (await useCases.customers.list.execute(query.limit, query.offset)).map(customerView))
  .post('/customers', async ({ body, set }) => { set.status = 201; return customerView(await useCases.customers.create.execute(body)); }, {
    body: t.Object({ name: t.String({ minLength: 2 }), document: t.String(), email: t.Optional(t.String()), phone: t.Optional(t.String()) })
  })
  .get('/customers/:id', async ({ params }) => customerView(await useCases.customers.get.execute(Number(params.id))))
  .patch('/customers/:id', async ({ params, body }) => customerView(await useCases.customers.update.execute(Number(params.id), body)), {
    body: t.Object({ name: t.Optional(t.String()), email: t.Optional(t.String()), phone: t.Optional(t.String()) })
  })
  .delete('/customers/:id', ({ params }) => useCases.customers.delete.execute(Number(params.id)), {
    detail: { summary: 'Exclui cliente e seus veículos e OS em cascata', description: 'Remove também itens, decisões e histórico das OS. Preserva catálogo, saldo, movimentos de estoque (sem vínculo à OS removida) e eventos de auditoria.' }
  });

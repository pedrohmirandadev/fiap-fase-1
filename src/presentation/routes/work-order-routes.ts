import { Elysia, t } from 'elysia';
import type { UseCases } from '../../composition';
import { WorkOrderStatus } from '../../domain/work-order/status';
import { ItemKind } from '../../domain/work-order/work-order-item';

export const itemSchema = t.Object({ type: t.Enum(ItemKind), id: t.Integer(), quantity: t.Integer({ minimum: 1 }) });

export const createPublicWorkOrderRoutes = (useCases: UseCases) => new Elysia()
  .get('/public/work-orders/:trackingCode', ({ params }) => useCases.workOrders.track.execute(params.trackingCode), {
    detail: { summary: 'Acompanha OS com código público não previsível' }
  })
  .post('/public/work-orders/:trackingCode/decision', ({ params, body }) => useCases.workOrders.decide.execute(params.trackingCode, body.approved, body.reason, body.quoteVersion), {
    body: t.Object({ approved: t.Boolean(), quoteVersion: t.Optional(t.Integer({ minimum: 1 })), reason: t.Optional(t.String({ maxLength: 500 })) }),
    detail: { summary: 'Registra decisão do cliente sobre orçamento' }
  });

export const createWorkOrderRoutes = (useCases: UseCases) => new Elysia()
  .post('/work-orders', async ({ body, set }) => { set.status = 201; return useCases.workOrders.create.execute(body); }, {
    body: t.Object({ customerId: t.Optional(t.Integer()), customerDocument: t.Optional(t.String()), vehicleId: t.Integer(), complaint: t.String({ minLength: 3 }), items: t.Array(itemSchema) }),
    detail: { summary: 'Cria OS e orçamento inicial' }
  })
  .get('/work-orders', ({ query }) => useCases.workOrders.list.execute(query.status, query.limit, query.offset), {
    query: t.Object({ status: t.Optional(t.Enum(WorkOrderStatus)), limit: t.Optional(t.String()), offset: t.Optional(t.String()) })
  })
  .post('/work-orders/:id/items', ({ params, body }) => useCases.workOrders.addItem.execute({ workOrderId: Number(params.id), item: body }), {
    body: itemSchema, detail: { summary: 'Propõe reparo adicional e exige nova aprovação do orçamento' }
  })
  .get('/work-orders/:id', ({ params }) => useCases.workOrders.get.execute(Number(params.id)))
  .post('/work-orders/:id/status', ({ params, body }) => useCases.workOrders.changeStatus.execute(Number(params.id), body.status, body.note), {
    body: t.Object({ status: t.Enum(WorkOrderStatus), note: t.Optional(t.String()) }),
    detail: { summary: 'Aplica uma transição válida e registra histórico' }
  })
  .get('/work-orders/:id/history', ({ params }) => useCases.workOrders.history.execute(Number(params.id)))
  .get('/metrics/average-execution-time', () => useCases.workOrders.average.execute());

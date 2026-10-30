# Do quadro à implementação

## Comandos principais

| Comando / intenção | Handler (src/application/use-cases/) | Comportamento | Porta HTTP existente |
|---|---|---|---|
| Receber OS | work-order/create-work-order.ts | WorkOrder.create | POST /api/v1/work-orders |
| Iniciar diagnóstico | work-order/start-diagnosis.ts | startDiagnosis | POST /work-orders/:id/status (DIAGNOSIS) |
| Apresentar orçamento | work-order/submit-quote.ts | submitQuote | POST /work-orders/:id/status (AWAITING_APPROVAL) |
| Aprovar orçamento | work-order/approve-quote.ts | approveQuote + Part.consumeForWorkOrder | POST /public/work-orders/:trackingCode/decision (approved=true) |
| Rejeitar orçamento | work-order/reject-quote.ts | rejectQuote | POST /public/work-orders/:trackingCode/decision (approved=false) |
| Propor adicional | work-order/propose-additional-repair.ts | proposeAdditionalRepair | POST /work-orders/:id/items |
| Finalizar reparo | work-order/finish-repair.ts | finishRepair | POST /work-orders/:id/status (FINISHED) |
| Registrar entrega | work-order/record-delivery.ts | recordDelivery | POST /work-orders/:id/status (DELIVERED) |
| Receber estoque | part/receive-stock.ts | recordReceipt | POST /parts/:id/movements (delta positivo) |
| Retirar estoque | part/withdraw-stock.ts | recordWithdrawal | POST /parts/:id/movements (delta negativo) |
| Cadastrar/atualizar/desativar | customer/, vehicle/, service/, part/, workshop/ | ações específicas da raiz | rotas CRUD correspondentes |

As rotas abreviadas na tabela usam o prefixo `/api/v1`. Os formatos existentes de status, decisão e movimentação continuam em uso; adaptadores encaminham cada intenção ao handler correspondente. Equipe técnica e estoquista são papéis do negócio, não permissões distintas no JWT atual.

## Eventos com envelope

| IDs | Evento(s) | Origem no domínio |
|---|---|---|
| E01/E02 | WorkOrderReceived, QuoteCalculated | WorkOrder.create |
| E03 | DiagnosisStarted | startDiagnosis |
| E04 | QuoteSubmitted | submitQuote e proposeAdditionalRepair |
| E05/E07 | QuoteApproved, ExecutionStarted | approveQuote, primeira execução |
| E06 | QuoteRejected | rejectQuote |
| E08/E09/E10 | AdditionalRepairProposed, ExecutionPaused, QuoteRevised | proposeAdditionalRepair |
| E11 | ExecutionResumed | approveQuote após execução anterior |
| E12 | RepairFinished | finishRepair |
| E13 | VehicleDelivered | recordDelivery |
| E14 | StockReceived | Part.recordReceipt |
| E15 | StockWithdrawn | Part.recordWithdrawal |
| E16 | PartsConsumed | Part.consumeForWorkOrder |
| E17 | MinimumStockReached | cruzamento do limite em saída/consumo |

`src/domain/shared/domain-event.ts` define os nomes dos eventos. `application/domain-event-store.ts` define a porta, implementada por `infrastructure/database/domain-event-store.ts` e `infrastructure/in-memory/domain-event-store.ts`. `migrations/0003_domain_model.sql` adiciona versões e a tabela de eventos.

Ao aprovar o orçamento, a aplicação grava todos os fatos no mesmo commit. Não há workflow distribuído nem subscriber para `QuoteApproved`; o handler coordena as operações de forma explícita.

## Consultas / modelos de leitura

| Modelo | Código | Uso |
|---|---|---|
| Cliente e veículos | GetCustomer, ListCustomers, GetVehicle, ListVehicles | escolher cliente/veículo e conferir vínculo |
| Catálogo de serviços | GetService, ListServices | selecionar serviço ativo e preço |
| Catálogo/saldo de peças | GetPart, ListParts | conferir saldo/mínimo e disponibilidade |
| Histórico de movimentos | ListPartMovements | auditar entradas/saídas |
| Fila de OS | ListWorkOrders + WorkOrderQueries.list | selecionar OS por status |
| Detalhe administrativo | GetWorkOrder + detail | itens, orçamento, decisões e histórico |
| Orçamento/progresso público | TrackWorkOrder + publicView | cliente consulta versão, total e itens antes de decidir |
| Histórico de status | GetWorkOrderHistory + history | explicar mudanças ao longo do tempo |
| Tempo médio | GetAverageExecutionTime | análise operacional |

`PgWorkOrderQueries` e `InMemoryWorkOrderQueries` leem o estado persistido de forma síncrona. Eles não reconstroem projeções a partir do log de eventos.

## Repositórios

Cada raiz tem um contrato em `src/domain/<conceito>/*-repository.ts`, um adaptador PostgreSQL em `src/infrastructure/repositories/` e outro em `src/infrastructure/in-memory/`. Os dois adaptadores atendem aos mesmos casos de uso. `WorkOrderRepository` oferece `find` e `save`; não permite alterar separadamente o orçamento, o consumo de itens, as decisões ou o histórico.


## Migração de dados existentes

A migração 0003 mantém as tabelas existentes e acrescenta colunas de versão. Para as OS antigas, ela usa as transições de IN_PROGRESS para AWAITING_APPROVAL para reconstruir as revisões e associa as decisões pelo timestamp. Esse backfill roda uma vez. Ele depende da integridade do histórico anterior e não recria eventos ausentes. As novas decisões gravam explicitamente a versão do agregado.

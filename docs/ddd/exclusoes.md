# Exclusões e relações entre entidades

## Política implementada

| Operação / relacionamento | Comportamento |
| --- | --- |
| `DELETE /api/v1/customers/{id}` | Remove o cliente, todos os seus veículos e suas OS. |
| `DELETE /api/v1/vehicles/{id}` | Remove o veículo e suas OS; mantém o cliente e seus outros veículos. |
| OS → itens, decisões e histórico de status | `ON DELETE CASCADE`: os filhos são removidos junto com a raiz. |
| OS → movimentos de estoque | `ON DELETE SET NULL`: mantém o movimento da peça, limpando o vínculo opcional à OS. |
| `DELETE /api/v1/services/{id}` | Desativa o serviço. Itens das OS existentes mantêm seus snapshots de descrição e preço. |
| `DELETE /api/v1/parts/{id}` | Desativa a peça. Preserva itens das OS, saldo e movimentos de estoque. |
| Catálogo → itens de OS / movimentos | A exclusão física direta de catálogo referenciado é impedida pelas FKs existentes. |
| Eventos de domínio já registrados | Preservados como auditoria; não possuem FK para a raiz. |

As rotas excluem clientes e veículos fisicamente, mesmo quando há OS finalizadas. A operação não devolve ao estoque as peças já consumidas: os registros de saldo e histórico permanecem válidos. A exclusão percorre os dependentes. Excluir uma OS não remove o cliente, o veículo nem itens compartilhados do catálogo.

Workshop e AdminUser não têm operações de exclusão na API. Workshop também não está associado às OS no modelo atual.

## Atomicidade e adaptadores

`DeleteCustomer` usa `CustomerRepository`; `DeleteVehicle` usa `VehicleRepository`. Ambos chamam `repository.delete(id)`, e o adaptador de persistência executa a cascata.

No PostgreSQL, um único `DELETE` do pai aciona as FKs na mesma transação. O adaptador em memória executa a cascata de forma síncrona, sem `await` entre as alterações. `cascade-deletion.ts` remove as OS e seus filhos embutidos e recria apenas os movimentos que precisam perder o vínculo. Os repositórios também participam de um `UnitOfWork` quando uma operação maior precisa de rollback.

Os repositórios continuam pertencendo às raízes. As exclusões não expõem operações independentes sobre WorkOrderItem, QuoteDecision ou StatusChange.

## Migração e verificação

`0004_cascade_deletions.sql` atualiza as FKs dos bancos existentes, adiciona índices às colunas de relacionamento e registra a migração em `schema_migrations`. Se executada novamente, ela não altera os dados nem troca as constraints outra vez.

```bash
bun run db:migrate
bun run test:memory
RUN_INTEGRATION=true bun --cwd=tests test cascade-deletions.integration.test.ts
```

O teste de integração exige `DATABASE_URL`. Para cada cenário, cria um schema exclusivo dentro de uma transação e desfaz as alterações, inclusive o DDL. Não usa o seed nem remove registros do schema da aplicação. O usuário do banco de teste precisa poder criar schemas.

O contrato exercita cliente, veículo, exclusões inexistentes ou repetidas, rollback e desativação de catálogo nos adaptadores em memória e PostgreSQL. Os testes PostgreSQL também conferem os filhos nas tabelas, a atualização de bancos com relações existentes, a reaplicação da migração e a cascata por SQL direto.

Referência para as ações de FK e seus índices: [documentação do PostgreSQL 17](https://www.postgresql.org/docs/17/ddl-constraints.html#DDL-CONSTRAINTS-FK).

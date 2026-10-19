# Exclusões e relacionamentos

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

Excluir cliente ou veículo é uma exclusão física, inclusive para OS finalizadas. A operação não estorna o consumo: a peça foi utilizada, e o saldo e seu histórico continuam válidos. A cascata segue dos pais para os dependentes; remover uma OS não remove o cliente, o veículo ou o catálogo compartilhado.

Workshop e AdminUser não têm operações de exclusão na API. Workshop também não está associado às OS no modelo atual.

## Atomicidade e adaptadores

`DeleteCustomer` recebe `CustomerRepository` e `DeleteVehicle` recebe `VehicleRepository`. Ambos chamam `repository.delete(id)`; a cascata é responsabilidade do adaptador de persistência.

No PostgreSQL, um único `DELETE` do pai aciona as FKs de forma atômica na mesma transação do comando. Em memória, o repositório executa a cascata sincronamente, sem `await` entre as alterações: `cascade-deletion.ts` remove as OS com seus filhos embutidos e recria apenas os movimentos cujo vínculo precisa ser limpo. Os repositórios também podem participar de um `UnitOfWork` quando uma operação maior precisar de rollback.

Os repositórios continuam pertencendo às raízes. As exclusões não expõem operações independentes sobre WorkOrderItem, QuoteDecision ou StatusChange.

## Migração e verificação

`0004_cascade_deletions.sql` altera as FKs de bancos existentes, adiciona índices nas colunas de relacionamento e registra sua aplicação em `schema_migrations`. A reaplicação não altera os dados nem repete a troca das constraints.

```bash
bun run db:migrate
bun run test:memory
RUN_INTEGRATION=true bun --cwd=tests test cascade-deletions.integration.test.ts
```

O teste de integração utiliza `DATABASE_URL` (ou o banco local padrão) e cria um schema exclusivo por cenário, dentro de uma transação revertida ao final, inclusive o DDL. Não usa o seed nem exclui registros do schema da aplicação. Requer permissão de criação de schema no banco de teste.

O mesmo contrato cobre cliente, veículo, exclusão inexistente/repetida, rollback e desativação de catálogo em memória e PostgreSQL. Os testes específicos de PostgreSQL verificam também os filhos nas tabelas, upgrade com relacionamentos existentes, reaplicação da migração e cascata por SQL direto.

Referência para as ações de FK e seus índices: [documentação do PostgreSQL 17](https://www.postgresql.org/docs/17/ddl-constraints.html#DDL-CONSTRAINTS-FK).

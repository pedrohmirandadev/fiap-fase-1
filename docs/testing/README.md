# Estratégia e execução dos testes

A pipeline completa e os checks obrigatórios estão descritos em [GitHub Actions](ci.md).

## Comandos

Todos os comandos partem da raiz do projeto, após `bun install`.

| Comando | Escopo | PostgreSQL necessário? |
| --- | --- | --- |
| `bun run test` | Suíte completa, incluindo todas as integrações | Sim |
| `bun run test:unit` | Domínio, casos de uso, DAO, metadados, mocks e fábricas | Não |
| `bun run test:controllers` | Aplicação Elysia real, requisições HTTP em processo e JWT real | Não |
| `bun run test:repositories` | Contratos dos sete repositórios em memória, consultas, eventos e transações | Não |
| `bun run test:memory` | Contratos acima, cascata e fluxos dos casos de uso em memória | Não |
| `bun run test:integration` | Contratos PostgreSQL, cascata, migrações e API por HTTP real | Sim |
| `bun run test:coverage` | Suíte completa com integração obrigatória e limiar de cobertura | Sim |
| `bun run typecheck` | Verificação de tipos, incluindo testes, helpers e mocks | Não |
| `bun run mocks:check` | Sincronização dos mocks com as interfaces | Não |

Para integração e cobertura:

```bash
docker compose up -d db
DATABASE_URL=postgres://oficina:oficina_local@127.0.0.1:5432/oficina bun run test:integration
DATABASE_URL=postgres://oficina:oficina_local@127.0.0.1:5432/oficina bun run test:coverage
```

Não é necessário iniciar a API, executar seed ou migrar previamente o banco: cada cenário integrado aplica as quatro migrações em seu próprio schema, dentro de uma transação revertida ao terminar. É necessário que o banco exista e que o usuário possa criar schemas. Os testes HTTP integrados iniciam e encerram a própria API em porta efêmera; não usam a porta 3000.

## Matriz de cobertura comportamental

| Camada | Arquivos de testes | Comportamentos principais |
| --- | --- | --- |
| Entidades e VOs | `tests/domain.test.ts`, `src/domain/**/*.test.ts` | CPF/CNPJ, placa, centavos, limites numéricos, overflow, igualdade, imutabilidade, alterações explícitas de Customer/Vehicle/Service/Part/Workshop, itens, decisões, histórico, eventos e transições de WorkOrder |
| Aplicação | `tests/application.test.ts`, `tests/in-memory.test.ts` | Cadastros, consultas, atualização parcial, ausência, erro de validação, catálogo inativo, relação cliente/veículo, orçamento, quantidades acumuladas, lock ordenado, versões, aprovação/rejeição, estoque e rollback |
| Repositórios | `tests/repositories.test.ts`, `tests/repositories.integration.test.ts`, `tests/support/repository-contract.ts` | Os mesmos testes para Customer, Vehicle, Service, Part, WorkOrder, Workshop e AdminUser; inserção, leitura, atualização, exclusão quando disponível, paginação, unicidade, FKs, versão otimista e hidratação dos agregados/VOs |
| Consultas e eventos | Contrato compartilhado de repositórios | Filtros, paginação, projeção administrativa/pública, privacidade, histórico, média exata em minutos e conteúdo JSON dos eventos persistidos |
| Transações | Contratos e casos de uso | Commit, retorno do callback, rollback de entidades/movimentos/eventos, falha no event store, consumo parcial de peças, serialização das transações em memória e recuperação após rejeição |
| Estado em memória | `tests/state.test.ts` | Inicialização de todos os módulos, sequências independentes, cópia dos contêineres, isolamento de snapshots e atualização das sessões live após commit |
| DAO e schema | `tests/infrastructure.test.ts` | SQL parametrizado, datas ISO, null/zero/false, propagação de erro, encaminhamento begin/savepoint, tabelas, índices e ações das FKs no Drizzle |
| Controllers e presenters | `tests/controllers.test.ts` | Todos os módulos HTTP, códigos/respostas, validação de schemas/enums, autenticação, expiração/ausência de claims JWT, mapeamento de erros e projeção de VOs |
| API com banco real | `tests/api.integration.test.ts` | Fluxo de OS, aprovação, adicional, estoque, cadastros, autenticação, histórico e métricas por servidor HTTP real e adaptadores PostgreSQL |
| Cascata e migrações | `tests/cascade-deletions.integration.test.ts`, `tests/support/cascade-deletion-contract.ts` | Exclusões relacionadas, rollback, catálogo, movimentos sem vínculo, atualização de banco com dados e reaplicação de migração |
| Documentação HTTP | `tests/controllers.test.ts` | HTML de OpenAPI, especificação JSON com rotas, página/artefatos do Event Storming, arquivos inexistentes e nomes não permitidos |
| Suporte de testes | `tests/infrastructure.test.ts` | Todos os métodos dos mocks, configuração obrigatória, isolamento, clear/reset, callback genérico e fábricas relacionadas válidas |

Os testes de OpenAPI e Event Storming verificam respostas e conteúdo HTTP; não executam JavaScript de navegador nem atestam a renderização visual do Scalar.

## Isolamento e dependências

- `createUseCases(context, unitOfWork, queries)` compõe os casos de uso com portas injetadas. `createApp({ useCases, checkDatabase, jwtSecret, corsOrigin })` permite executar os controllers sem banco ou socket. A composição padrão de produção continua exportada.
- `createMockEnvironment()` serve para controlar respostas, falhas e verificar chamadas. Veja [mocks e fábricas](mocks.md).
- `createInMemoryEnvironment()` testa o comportamento persistente e os limites transacionais com estado real em memória.
- `createPostgresTestEnvironment()` cria schema aleatório, aplica migrações e faz rollback inclusive do DDL. Os testes de restrições usam savepoints, para não invalidar o restante da transação.
- As integrações não apagam nem alteram os registros do schema `public`, não dependem de credenciais administrativas do seed e podem ser repetidas.

Para acrescentar um teste de contrato, edite `tests/support/repository-contract.ts`: o cenário será registrado nos dois adaptadores. Use fixtures novas por cenário e faça asserções sobre dados retornados, estado persistido e efeitos proibidos; contagem de chamadas sozinha não demonstra rollback.

## Medição de cobertura

`bunfig.toml` mantém limiar de **90% em linhas e funções**, aplicado por arquivo pelo Bun 1.3.8. A cobertura inclui domínio, aplicação, composição, repositórios PostgreSQL e em memória, consultas, event stores, DAO, UnitOfWork, schema Drizzle, aplicação HTTP, rotas e presenters.

`bun test`, `bun test --coverage`, `bun run test` e `bun run test:coverage` sempre executam as integrações. Não existe mais condição `RUN_INTEGRATION` nem seleção automática que pule testes por falta de banco: PostgreSQL indisponível provoca falha explícita. O comando de cobertura gera relatório no terminal e `coverage/lcov.info`, e falha se algum arquivo medido ficar abaixo de 90% em linhas ou funções. Para executar somente testes sem banco, use `test:unit`, `test:controllers`, `test:repositories` ou `test:memory`.

Exclusões explícitas da medição:

- `src/index.ts`: inicialização do processo/servidor.
- `src/infrastructure/database/connection.ts`: configuração da conexão de produção.
- `src/infrastructure/database/migrate.ts` e `seed.ts`: pontos de entrada operacionais. As migrações SQL são aplicadas e exercitadas pelos testes integrados; o runner CLI e o seed de demonstração não têm cobertura automatizada nesta suíte.
- Arquivos de testes, helpers, mocks e fábricas: suporte exercitado pelos testes, fora do percentual do código de produção.

Interfaces sem código executável não precisam de testes artificiais. Cobertura de linhas/funções não mede todos os caminhos possíveis, carga, concorrência entre conexões PostgreSQL distintas ou vulnerabilidades. Resultados executados estão em [verificações](../evidencias/verificacoes.md).

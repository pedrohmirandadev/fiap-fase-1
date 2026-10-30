# Estratégia e execução dos testes

O arquivo [GitHub Actions](ci.md) descreve a pipeline completa e os checks exigidos.

## Comandos

Execute os comandos na raiz do projeto. Os comandos nativos precisam de `bun install`; o runner do Compose instala as dependências ao construir a imagem.

| Comando | Escopo | PostgreSQL necessário? |
| --- | --- | --- |
| `bun run test` | Suíte completa, incluindo todas as integrações | Sim |
| `bun run test:unit` | Domínio, casos de uso, DAO, metadados, mocks e fábricas | Não |
| `bun run test:controllers` | Aplicação Elysia real, requisições HTTP em processo e JWT real | Não |
| `bun run test:repositories` | Contratos dos sete repositórios em memória, consultas, eventos e transações | Não |
| `bun run test:memory` | Contratos acima, cascata e fluxos dos casos de uso em memória | Não |
| `bun run test:integration` | Contratos PostgreSQL, cascata, migrações e API por HTTP real | Sim |
| `bun run test:coverage` | Suíte completa com integração obrigatória e limiar de cobertura | Sim |
| `docker compose -p oficina-tests --profile test run --build --rm test-runner` | Suíte completa com cobertura; o Compose prepara um PostgreSQL isolado | Não precisa de banco no host |
| `docker compose -p oficina-tests --profile test run --build --rm test-runner bun run test:integration` | Somente integrações no PostgreSQL isolado do Compose | Não precisa de banco no host |
| `bun run typecheck` | Verificação de tipos, incluindo testes, helpers e mocks | Não |
| `bun run mocks:check` | Sincronização dos mocks com as interfaces | Não |

Para integração e cobertura diretamente no host, com um PostgreSQL já disponível:

```bash
cp .env.example .env  # opcional: personalize as configurações locais
set -a
. ./.env
set +a
export DATABASE_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:${POSTGRES_HOST_PORT}/${POSTGRES_DB}"
docker compose up -d db
bun run test:integration
bun run test:coverage
```

Para avaliação sem configurar PostgreSQL ou instalar Bun no host, use o runner Docker:

```bash
docker compose -p oficina-tests --profile test run --build --rm test-runner
docker compose -p oficina-tests --profile test down
```

No Linux com Docker Engine, use `sudo` antes desses comandos se a conta ainda não tiver acesso a `/var/run/docker.sock`.

O comando pode receber `bun run test:integration` para executar apenas as integrações. O serviço `test-db` não publica porta e não compartilha o volume do banco de demonstração; o runner aplica as migrações em schemas próprios e reverte cada cenário. O perfil de teste não inicia a API nem executa o seed.

Não inicie a API, rode o seed nem aplique as migrações antes da suíte. Cada cenário integrado cria um schema próprio, aplica as quatro migrações e reverte a transação ao terminar. O banco precisa estar disponível, e o usuário precisa ter permissão para criar schemas. Os testes HTTP sobem sua própria API em uma porta temporária; não usam a porta 3000.

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

Os testes de OpenAPI e Event Storming conferem as respostas e o conteúdo HTTP. Eles não executam JavaScript no navegador nem avaliam a aparência do Scalar.

## Isolamento e dependências

- `createUseCases(context, unitOfWork, queries)` monta os casos de uso com portas injetadas. `createApp({ useCases, checkDatabase, jwtSecret, corsOrigin })` permite executar os controllers sem banco ou socket. A composição de produção continua disponível.
- `createMockEnvironment()` controla respostas e falhas e permite conferir chamadas. Veja [mocks e fábricas](mocks.md).
- `createInMemoryEnvironment()` executa casos de uso com estado persistente em memória para conferir o comportamento transacional.
- `createPostgresTestEnvironment()` cria um schema aleatório, aplica as migrações e reverte as mudanças, inclusive o DDL. Os testes de restrição usam savepoints para manter ativa a transação principal.
- As integrações podem ser repetidas. Elas não alteram o schema `public` e não dependem das credenciais administrativas do seed.

Para adicionar um teste de contrato, edite `tests/support/repository-contract.ts`. O cenário será executado nos dois adaptadores. Crie fixtures para cada cenário e confira os dados retornados, o estado persistido e os efeitos que não devem ocorrer. A contagem de chamadas, sozinha, não comprova rollback.

## Medição de cobertura

O projeto aplica o limiar de **90% em linhas e funções por arquivo**, definido em `bunfig.toml`. A medição inclui domínio, aplicação, composição, repositórios PostgreSQL e em memória, consultas, event stores, DAO, UnitOfWork, schema Drizzle, aplicação HTTP, rotas e presenters. Consulte os números da última execução na [evidência de cobertura](coverage-evidence-2026-10-30.md).

`bun test`, `bun test --coverage`, `bun run test` e `bun run test:coverage` executam as integrações. Eles não usam `RUN_INTEGRATION` nem ignoram os testes quando o banco está indisponível; nesse caso, o comando falha. A cobertura aparece no terminal e em `coverage/lcov.info`. O comando retorna erro se algum arquivo medido ficar abaixo de 90% em linhas ou funções. Para rodar apenas testes sem banco, use `test:unit`, `test:controllers`, `test:repositories` ou `test:memory`.

Exclusões explícitas da medição:

- `src/index.ts`: inicializa o processo e o servidor.
- `src/infrastructure/database/connection.ts`: configura a conexão de produção.
- `src/infrastructure/database/migrate.ts` e `seed.ts`: pontos de entrada operacionais. Os testes integrados aplicam e exercitam as migrações SQL; esta suíte não mede o runner CLI nem o seed de demonstração.
- Arquivos de testes, helpers, mocks e fábricas: fazem parte do suporte de testes e ficam fora da cobertura do código de produção.

Interfaces sem código executável não precisam de testes artificiais. Cobertura de linhas e funções não mede todos os caminhos, carga, concorrência entre conexões PostgreSQL ou vulnerabilidades.

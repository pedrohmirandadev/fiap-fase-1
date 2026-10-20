# Oficina — Tech Challenge Fase 1

MVP backend para organizar clientes, veículos, serviços, estoque e ordens de serviço. A API permite criar o orçamento, registrar aprovação ou rejeição pelo cliente e acompanhar o progresso por um código público aleatório.

## Tecnologias e arquitetura

- Bun 1.3+, TypeScript, Elysia, PostgreSQL 17, Drizzle ORM e postgres.js.
- Monólito modular com DDD e Clean Architecture: `domain/` contém entidades, objetos de valor, invariantes e interfaces de repositório por agregado. `application/use-cases/` contém um caso de uso por ação. `infrastructure/repositories/` contém um adaptador PostgreSQL por repositório; `presentation/routes/` contém os adaptadores HTTP por módulo.
- A dependência segue de fora para dentro: as rotas chamam casos de uso, que dependem apenas de entidades e contratos. Leituras detalhadas da OS usam uma porta de consulta própria. `src/composition.ts` conecta os adaptadores e `PgUnitOfWork` executa os casos de uso transacionais.
- `src/infrastructure/in-memory/` implementa os mesmos contratos para testar casos de uso sem PostgreSQL. `InMemoryUnitOfWork` trabalha sobre uma cópia do estado e só a publica quando a operação termina com sucesso.
- PostgreSQL foi escolhido por manter relações e histórico com chaves estrangeiras, restrições e transações nos fluxos de OS e estoque.
- Elysia gera documentação OpenAPI em `/openapi`. As rotas administrativas usam JWT.
- Valores fechados usam os enums `WorkOrderStatus`, `ItemKind`, `DomainEventName`, `AggregateType`, `DomainErrorKind` e `ErrorKind`. Rotas e persistência reutilizam os tipos do domínio; a API mantém os mesmos valores textuais. O filtro `GET /api/v1/work-orders?status=IN_PROGRESS` valida os estados de `WorkOrderStatus`.

## Executar com Docker Compose

Pré-requisitos: Docker Desktop com Compose v2. Na raiz:

```bash
docker compose up --build
```

O Compose aguarda o healthcheck do banco. A API executa a migração e o seed ao iniciar. Endereços: API `http://localhost:3000`, saúde `http://localhost:3000/health`, OpenAPI/Scalar `http://localhost:3000/openapi` e especificação JSON `http://localhost:3000/openapi/json`. A porta do PostgreSQL publicada no host é 5432; entre containers, a API usa 5432.

Credenciais fictícias locais: `admin@oficina.local` / `TroqueEstaSenha123!`. Troque-as antes de publicar ou compartilhar o ambiente. Para encerrar: `docker compose down`; para apagar também o banco local: `docker compose down -v`.

## Execução sem container para a API

Use Bun 1.3 ou superior e um PostgreSQL acessível. Copie `.env.example` para `.env`, ajuste `DATABASE_URL` e os segredos, então:

```bash
bun install
bun run db:migrate
bun run db:seed
bun run dev
```

## Autenticação e demonstração

Faça `POST /api/v1/auth/login` com JSON `{"email":"admin@oficina.local","password":"TroqueEstaSenha123!"}`. Envie o token retornado como `Authorization: Bearer <token>` nas rotas administrativas.

O seed cria a cliente Marina Souza (CPF fictício válido para teste), Honda Civic ABC1D23, serviços de troca de óleo/alinhamento e itens de estoque. Cadastre a oficina em `POST /api/v1/workshops` e consulte em `GET /api/v1/workshops/{id}`. Crie uma OS com IDs obtidos nas listagens. Para demonstrar todo o fluxo: mova a OS de `RECEIVED` para `DIAGNOSIS`, depois para `AWAITING_APPROVAL`; consulte o `trackingCode`; aprove em `/api/v1/public/work-orders/{trackingCode}/decision`; a aprovação baixa estoque e inicia execução. Para simular um reparo adicional, use `POST /api/v1/work-orders/{id}/items`: o sistema recalcula o orçamento e exige uma segunda aprovação antes de continuar. Finalize movendo a OS para `FINISHED` e `DELIVERED`.

## API e coleção Insomnia

Importe `docs/insomnia/oficina-insomnia.json` no Insomnia. O ambiente base `Local` usa `http://localhost:3000`; a coleção inclui requisições para os métodos documentados, exemplos e cenários de erro. Após o login, copie o JWT para `jwt`; após criar uma OS, copie `id` para `work_order_id`, `trackingCode` para `tracking_code` e `quoteVersion` para `quote_version`. Atualize `quote_version` após propor um reparo adicional. A documentação interativa em `/openapi` é uma página para abrir no navegador; `/openapi/json` é a especificação para clientes HTTP. Login usa **POST**, não GET.

### Exclusões em cascata

Excluir um cliente remove seus veículos e OS; excluir um veículo remove suas OS. Em ambos os casos, itens, decisões e histórico dessas ordens são removidos na mesma transação. Movimentos de estoque e eventos de auditoria são preservados; o movimento perde o vínculo com a OS removida, e o saldo não é estornado. As rotas DELETE de serviços e peças desativam o catálogo, preservando suas referências. Detalhes e verificação: [política de exclusões](docs/ddd/exclusoes.md).

Para atualizar um banco já existente, execute `bun run db:migrate`; o Docker Compose também aplica a migração ao iniciar a API.

## Testes e segurança

```bash
# Testes que não precisam de banco:
bun run test:unit
bun run test:controllers
bun run test:repositories
bun run test:memory
bun run typecheck
bun run mocks:check

# Suíte completa e cobertura (PostgreSQL obrigatório):
docker compose up -d db
DATABASE_URL=postgres://oficina:oficina_local@127.0.0.1:5432/oficina bun run test
DATABASE_URL=postgres://oficina:oficina_local@127.0.0.1:5432/oficina bun run test:integration
DATABASE_URL=postgres://oficina:oficina_local@127.0.0.1:5432/oficina bun run test:coverage

bun run security:audit
```

`bun run test:memory` executa apenas os testes dos repositórios em memória e dos casos de uso; não precisa de Docker, PostgreSQL nem `DATABASE_URL`. Para escrever outro teste, chame `createInMemoryEnvironment()` de `src/infrastructure/in-memory/context.ts` e injete `repositories`, `unitOfWork` e `workOrderQueries` nos casos de uso. Cada chamada cria um estado isolado.

### Análise de qualidade e segurança com SonarQube

O SonarQube Community Build local analisa o código TypeScript em busca de bugs, vulnerabilidades e pontos de manutenção, e importa a cobertura LCOV gerada pelo Bun. O servidor e seu PostgreSQL ficam em um perfil Docker separado dos serviços normais da aplicação.

1. Opcionalmente, configure `SONAR_DB_PASSWORD` no arquivo `.env`. Inicie somente o SonarQube e o banco dele:

   ```bash
   docker compose --profile sonar up -d sonarqube
   ```

2. Aguarde o servidor ficar disponível em `http://localhost:9000`, entre com as credenciais iniciais `admin` / `admin`, troque a senha e gere um token de análise do tipo **Project Analysis Token**.
3. Salve o token como `SONAR_TOKEN` em `.env` e gere cobertura e análise:

   ```bash
   bun run test:sonar
   bun run sonar:scan
   ```

O resultado aparece no projeto `oficina-tech-challenge` no SonarQube. Para encerrar os serviços sem apagar os dados: `docker compose --profile sonar down`. Não use `down -v` se quiser preservar o histórico e as configurações do SonarQube.

```ts
const { repositories, unitOfWork, workOrderQueries } = createInMemoryEnvironment();
const createCustomer = new CreateCustomer(repositories.customers);
const customer = await createCustomer.execute({ name: 'Marina Souza', document: '52998224725' });
// Injete unitOfWork nos casos de uso transacionais e workOrderQueries nas consultas.
```

Para testes com controle de retornos e inspeção de chamadas, use `createMockEnvironment()` de `tests/mocks`. Uma chamada cria os mocks dos sete repositórios, eventos, consultas de OS e UnitOfWork, além de entidades fictícias relacionadas. `bun run mocks:generate` atualiza os mocks a partir das interfaces; `bun run mocks:check` confere a sincronização. Exemplos: [mocks e fábricas](docs/testing/mocks.md).

O limiar de cobertura é **90% por arquivo em linhas e funções**, incluindo **domínio, aplicação, infraestrutura e apresentação**. `test:coverage` executa obrigatoriamente as integrações. Os testes PostgreSQL aplicam as migrações em schemas exclusivos e revertem os dados e o DDL ao terminar; não precisam de seed nem da API já iniciada. `bun test`, `bun test --coverage`, `bun run test` e `bun run test:coverage` executam todas as integrações, sem depender de `RUN_INTEGRATION` e sem pulá-las. Os comandos completos exigem PostgreSQL; use `test:unit`, `test:controllers`, `test:repositories` ou `test:memory` para executar apenas os testes sem banco.

Veja a [matriz de testes, comandos e exclusões da cobertura](docs/testing/README.md), as [verificações executadas](docs/evidencias/verificacoes.md) e o [relatório de auditoria de dependências](docs/security/dependency-audit.md).

## Estrutura

```text
src/domain/<agregado>/            entidade e interface do seu repositório
src/domain/shared/                objetos de valor e erro de domínio
src/application/use-cases/<area>/ um arquivo por caso de uso
src/application/unit-of-work.ts   contrato de transação
src/application/work-order-queries.ts  porta de leitura da OS
src/infrastructure/repositories/  um adaptador PostgreSQL por repositório
src/infrastructure/queries/       consultas de leitura da OS
src/infrastructure/database/      DAO SQL, Unit of Work, schema, migração e seed
src/infrastructure/in-memory/     adaptadores, consultas e Unit of Work em memória
src/presentation/routes/          rotas Elysia por módulo
src/presentation/presenters.ts    mapeamento de entidades para respostas HTTP
src/composition.ts                composição das dependências
migrations/                       SQL versionado
tests/                            testes integrados e sem banco
docs/ddd/                         Event Storming e linguagem ubíqua
docs/insomnia/                    coleção exportada
docs/video/                       roteiro de demonstração
docs/entrega/                     modelo preenchível do PDF final
docs/security/                    relatório de análise de dependências
docs/evidencias/                  resultados observados de execução
.agents/skills/                   instruções reutilizáveis do projeto
```

## Event Storming em oito etapas

Abra **http://localhost:3000/event-storming/** com a API em execução ou abra `docs/ddd/event-storming/index.html` diretamente no navegador, sem rede. O material separa descoberta, timeline, pontos de atenção, eventos pivotais, comandos/atores, leituras/políticas, agregados/entidades/VOs e bounded contexts. Inclui SVGs independentes, Mermaid e explicações de cada etapa.

A OS usa comportamentos explícitos, handlers por intenção e persistência do agregado completo. Aprovação e movimentos de estoque registram eventos em `domain_events` junto com a transação. Não há broker ou Event Sourcing. Orçamento e decisões possuem versão; envie `quoteVersion` retornado no acompanhamento público ao aprovar/rejeitar. O campo permanece opcional por compatibilidade, e quando enviado rejeita uma versão obsoleta.

Para regenerar os quadros: `python3 scripts/generate-event-storming.py`. Detalhes: [modelo tático](docs/ddd/modelo-tatico.md), [decisões](docs/ddd/decisoes.md) e [rastreabilidade](docs/ddd/rastreabilidade.md).

## DDD e entrega acadêmica

Veja [documentação DDD](docs/ddd/README.md), [roteiro do vídeo](docs/video/roteiro.md) e [modelo de entrega](docs/entrega/modelo.md). Preencha os campos de grupo, integrantes, RMs, Discord, URLs, branch/tag e hash final. O Event Storming pode ser montado em Miro ou equivalente; mantenha uma exportação versionada aqui e libere o link externo para visualização sem solicitação de acesso.

## Limitações atuais do MVP

- A API cobre operações principais; faltam paginação/filtros em algumas listagens e atualização de todos os campos em todos os recursos.
- A rejeição é registrada sem um estado próprio (o desafio não define um estado de rejeição); a OS continua aguardando decisão para permitir nova decisão após ajuste do orçamento.
- Não há integração real de notificações. O cliente consulta o orçamento e progresso pela API.
- O grupo ainda precisa preencher dados acadêmicos, criar o Event Storming externo, publicar o repositório e gravar/publicar o vídeo da entrega.

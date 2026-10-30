# Oficina: Tech Challenge Fase 1

Backend MVP para organizar clientes, veículos, serviços, estoque e ordens de serviço. A API cria orçamentos, registra a decisão do cliente e acompanha o andamento da OS por um código público aleatório.

## Tecnologias e arquitetura

- Bun 1.3+, TypeScript, Elysia, PostgreSQL 17, Drizzle ORM e postgres.js.
- O sistema é um monólito modular com DDD e Clean Architecture. `domain/` guarda entidades, objetos de valor, invariantes e interfaces de repositório. Há um caso de uso por ação em `application/use-cases/`, adaptadores PostgreSQL em `infrastructure/repositories/` e rotas HTTP em `presentation/routes/`.
- As rotas chamam casos de uso, que dependem das entidades e dos contratos do domínio. As consultas detalhadas de OS usam uma porta própria. `src/composition.ts` monta os casos de uso a partir de portas; `src/production-composition.ts` liga os adaptadores PostgreSQL; `PgUnitOfWork` executa os casos que precisam de transação.
- `src/infrastructure/in-memory/` implementa os mesmos contratos para executar casos de uso sem PostgreSQL. `InMemoryUnitOfWork` aplica a operação a uma cópia do estado e só publica essa cópia quando tudo termina com sucesso.
- PostgreSQL foi escolhido por manter relações e histórico com chaves estrangeiras, restrições e transações nos fluxos de OS e estoque.
- Elysia gera documentação OpenAPI em `/openapi`. As rotas administrativas usam JWT.
- Os enums `WorkOrderStatus`, `ItemKind`, `DomainEventName`, `AggregateType`, `DomainErrorKind` e `ErrorKind` definem os valores fechados. Rotas e persistência reutilizam os tipos do domínio, e a API mantém os mesmos valores textuais. O filtro `GET /api/v1/work-orders?status=IN_PROGRESS` valida o estado com `WorkOrderStatus`.

## Executar com Docker Compose

Pré-requisito: Docker com Compose v2 (Docker Desktop no Windows/macOS ou Docker Engine no Linux). Para iniciar a API para avaliação, não é necessário instalar Bun, criar `.env` ou preencher credenciais:

```bash
docker compose up --build
```

No Linux com Docker Engine, se o comando retornar `permission denied` para `/var/run/docker.sock`, repita os comandos Docker com `sudo` ou conceda ao usuário acesso ao grupo `docker` e entre novamente na sessão. Esse grupo permite administrar o daemon Docker.

O Compose espera o banco passar no healthcheck. Quando inicia, a API aplica as migrações e executa o seed com registros fictícios. A API fica em `http://localhost:3000`, o healthcheck em `http://localhost:3000/health`, a documentação OpenAPI/Scalar em `http://localhost:3000/openapi` e o JSON em `http://localhost:3000/openapi/json`. As portas publicadas aceitam conexões apenas pelo próprio computador. O PostgreSQL fica na porta 5432 por padrão; se ela estiver ocupada, copie `.env.example` para `.env` e altere `POSTGRES_HOST_PORT`.

Credenciais fictícias para login: `admin@oficina.local` / `TroqueEstaSenha123!`. Esses valores e os dados do seed servem apenas para a avaliação local. Para encerrar: `docker compose down`; para apagar também o banco e os dados locais: `docker compose down -v`.

## Execução sem container para a API

Para executar a API fora do container, use Bun 1.3 ou superior. O PostgreSQL pode ser iniciado pelo Compose e as variáveis locais vêm do arquivo de exemplo:

```bash
cp .env.example .env
docker compose up -d db
bun install
bun run db:setup
bun run dev
```

O seed inclui uma conta administrativa e cadastros de demonstração. A aplicação encerra a inicialização se não receber `DATABASE_URL` ou uma `JWT_SECRET` com ao menos 32 caracteres; o `.env.example` já fornece valores fictícios adequados para a avaliação local.
Ao executar `bun run dev` diretamente no host, a API escuta somente em `127.0.0.1` por padrão. No Compose, ela escuta dentro da rede do container e a porta publicada continua limitada ao loopback do computador.
Se você mudou `POSTGRES_HOST_PORT` e executar a API fora do container, ajuste também a porta em `DATABASE_URL` no `.env`; dentro do Compose, a API continua acessando o banco pelo endereço interno `db:5432`.

## Autenticação e demonstração

Faça `POST /api/v1/auth/login` com as credenciais administrativas configuradas no ambiente local. O corpo exige `email` e `password`; evite registrar a senha em arquivos versionados. Envie o token retornado como `Authorization: Bearer <token>` nas rotas administrativas.

O seed inclui a cliente fictícia Marina Souza, um Honda Civic de placa ABC1D23, serviços de troca de óleo e alinhamento e itens de estoque. Cadastre a oficina em `POST /api/v1/workshops` e consulte-a em `GET /api/v1/workshops/{id}`. Depois, crie uma OS usando IDs obtidos nas listagens. Para percorrer o fluxo, avance a OS de `RECEIVED` para `DIAGNOSIS` e `AWAITING_APPROVAL`. Consulte o `trackingCode` e envie a decisão para `/api/v1/public/work-orders/{trackingCode}/decision`. A aprovação inicia a execução e baixa o estoque. Para simular um reparo adicional, use `POST /api/v1/work-orders/{id}/items`; o sistema atualiza o orçamento e aguarda uma nova aprovação. Encerre a OS nos estados `FINISHED` e `DELIVERED`.

## API e coleção Insomnia

Importe `docs/insomnia/oficina-insomnia.json` no Insomnia. O ambiente `Local` aponta para `http://localhost:3000` e a coleção contém exemplos e cenários de erro para as operações documentadas. Depois do login, salve o JWT em `jwt`. Ao criar uma OS, salve `id`, `trackingCode` e `quoteVersion` em `work_order_id`, `tracking_code` e `quote_version`. Atualize `quote_version` se propuser um reparo adicional. Abra `/openapi` no navegador para consultar a documentação interativa; use `/openapi/json` para obter a especificação. Faça login com `POST`; `GET` não é aceito.

### Exclusões em cascata

Ao excluir um cliente, o sistema remove seus veículos e OS. Ao excluir um veículo, remove suas OS. Itens, decisões e histórico das ordens são removidos na mesma transação. O sistema preserva movimentos de estoque e eventos de auditoria; os movimentos ficam sem vínculo com a OS excluída e o saldo não é estornado. As rotas DELETE de serviços e peças desativam esses itens do catálogo e mantêm suas referências. Consulte a [política de exclusões](docs/ddd/exclusoes.md).

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

# Suíte completa com cobertura; Compose inicia um PostgreSQL isolado para os testes:
docker compose -p oficina-tests --profile test run --build --rm test-runner

# Somente testes de integração:
docker compose -p oficina-tests --profile test run --build --rm test-runner bun run test:integration

# Encerre e remova os containers da suíte:
docker compose -p oficina-tests --profile test down

bun run security:audit
```

Os comandos Docker de teste não iniciam a API de demonstração nem usam o banco persistente dela. O banco dos testes não publica porta no computador; cada cenário cria e reverte seu schema. Também é possível usar os atalhos `bun run test:docker` e `bun run test:integration:docker` se Bun já estiver instalado no host.

`bun run test:memory` executa os casos de uso e os repositórios em memória. Esse comando não precisa de Docker, PostgreSQL ou `DATABASE_URL`. Para criar um teste, chame `createInMemoryEnvironment()` de `src/infrastructure/in-memory/context.ts` e injete `repositories`, `unitOfWork` e `workOrderQueries` no caso de uso. Cada chamada cria um estado isolado.

### Análise de qualidade e segurança com SonarQube

O SonarQube Community Build local analisa o código TypeScript e importa a cobertura LCOV do Bun. O perfil Docker `sonar` mantém o servidor e seu PostgreSQL separados dos serviços normais da aplicação.

1. Para habilitar o perfil, configure `SONAR_DB_PASSWORD` no arquivo `.env`. Inicie somente o SonarQube e o banco dele:

   ```bash
   docker compose --profile sonar up -d sonarqube
   ```

2. Quando o servidor responder em `http://localhost:9000`, entre com a credencial inicial configurada no ambiente, troque-a e gere um token do tipo **Project Analysis Token**.
3. Salve o token como `SONAR_TOKEN` em `.env` e gere cobertura e análise:

   ```bash
   bun run test:sonar
   bun run sonar:scan
   ```

Consulte o resultado no projeto `oficina-tech-challenge` do SonarQube. O serviço só aceita conexões locais. Para encerrar e preservar os dados, execute `docker compose --profile sonar down`. Evite `down -v` se quiser manter o histórico e as configurações do SonarQube.

```ts
const { repositories, unitOfWork, workOrderQueries } = createInMemoryEnvironment();
const createCustomer = new CreateCustomer(repositories.customers);
const customer = await createCustomer.execute({ name: 'Marina Souza', document: '52998224725' });
// Injete unitOfWork nos casos de uso transacionais e workOrderQueries nas consultas.
```

Use `createMockEnvironment()` de `tests/mocks` quando precisar controlar retornos e inspecionar chamadas. Cada chamada cria mocks dos sete repositórios, eventos, consultas de OS e UnitOfWork, além das entidades relacionadas. `bun run mocks:generate` gera os mocks a partir das interfaces; `bun run mocks:check` verifica se estão sincronizados. Veja [mocks e fábricas](docs/testing/mocks.md).

O projeto exige cobertura de **90% em linhas e funções por arquivo medido**, incluindo domínio, aplicação, infraestrutura e apresentação. `test:coverage` sempre executa as integrações. Os testes PostgreSQL aplicam as migrações em schemas exclusivos e revertem os dados e o DDL ao terminar. Eles não precisam do seed nem de uma API já iniciada. `bun test`, `bun test --coverage`, `bun run test` e `bun run test:coverage` executam todas as integrações e precisam de um PostgreSQL em `DATABASE_URL`; para a avaliação sem configurar banco, use o serviço `test-runner` do Compose. Esses comandos não dependem de `RUN_INTEGRATION` e não ignoram testes. Para executar apenas testes sem banco, use `test:unit`, `test:controllers`, `test:repositories` ou `test:memory`.

Veja a [matriz de testes, comandos e exclusões da cobertura](docs/testing/README.md), a [evidência de cobertura executada em 30/10/2026](docs/testing/coverage-evidence-2026-10-30.md), a [pipeline de qualidade](docs/testing/ci.md), o [relatório de vulnerabilidades em PDF](docs/security/vulnerability-report.pdf) (com [fonte editável em Markdown](docs/security/vulnerability-report.md)) e a [auditoria de dependências](docs/security/dependency-audit.md).

## Integração contínua

O GitHub Actions executa a suíte completa com PostgreSQL e verifica tipos e mocks. A pipeline exige cobertura global de linhas e funções acima de 90%, pelo menos 90% em cada arquivo medido e nenhum teste ignorado. Em seguida, inicia um SonarQube temporário com o Compose da `main`, importa o LCOV e aguarda o Quality Gate. A pipeline não precisa de secrets externos.

O check final **Quality Gate** reúne esses resultados. Marque-o como obrigatório na proteção da `main` para bloquear merges que falhem nas verificações. Consulte a [pipeline de qualidade](docs/testing/ci.md) para detalhes, artefatos e instruções de reprodução.

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
src/composition.ts                monta os casos de uso com portas injetadas
src/production-composition.ts     conecta os casos de uso aos adaptadores PostgreSQL
src/presentation/production-app.ts  cria a API com dependências de produção
migrations/                       SQL versionado
tests/                            testes integrados e sem banco
docs/ddd/                         Event Storming e linguagem ubíqua
docs/insomnia/                    coleção exportada
```

## Event Storming em oito etapas

Com a API em execução, abra **http://localhost:3000/event-storming/**. Também é possível abrir `docs/ddd/event-storming/index.html` diretamente no navegador, sem conexão de rede. O material percorre descoberta, linha do tempo, pontos de atenção, eventos pivotais, comandos e atores, leituras e políticas, agregados, entidades, VOs e bounded contexts. Cada etapa tem um SVG independente, um diagrama Mermaid e uma explicação em Markdown.

Os handlers executam ações explícitas da OS e persistem o agregado completo. A aprovação e as movimentações de estoque gravam eventos em `domain_events` na mesma transação. O projeto não usa broker nem Event Sourcing. Cada orçamento tem uma versão. Ao aprovar ou rejeitar, envie o `quoteVersion` retornado pelo acompanhamento público; a API recusa versões antigas.

Para gerar os quadros novamente, execute `python3 scripts/generate-event-storming.py`. Consulte também o [modelo tático](docs/ddd/modelo-tatico.md), as [decisões](docs/ddd/decisoes.md) e a [rastreabilidade](docs/ddd/rastreabilidade.md).

## Documentação DDD e demonstração

Consulte a [documentação DDD](docs/ddd/README.md), sua [versão exportada em PDF](docs/ddd/documentacao-ddd.pdf) e o [quadro de DDD e Event Storming no Miro](https://miro.com/app/board/uXjVEXyyV68=/?share_link_id=376913126076), disponível para visualização. Esses materiais descrevem o modelo de domínio e sua relação com a implementação. O link do vídeo público de demonstração será incluído aqui após a publicação.
## Limitações atuais do MVP

- A API cobre as operações principais. Algumas listagens ainda não têm paginação ou filtros, e nem todos os recursos permitem atualizar todos os campos.
- A API registra a rejeição do orçamento, mas não muda a OS para um estado próprio de rejeição, que o desafio não define. A OS continua em espera para permitir outra decisão depois de um ajuste no orçamento.
- O sistema não envia notificações. O cliente consulta o orçamento e o andamento pela API.

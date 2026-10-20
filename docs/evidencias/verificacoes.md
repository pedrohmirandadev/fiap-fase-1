# Verificações executadas

Execuções registradas em 2026-09-28 e 2026-09-29, após a reconstrução da arquitetura DDD:

| Verificação | Resultado |
|---|---|
| `bun run typecheck` | Aprovado, sem erros TypeScript. |
| `bun run test:memory` | 2 testes passaram; 0 falharam. Casos de uso de cadastros, autenticação e fluxo de OS rodaram sem PostgreSQL; aprovação com estoque insuficiente comprovou rollback de estoque, decisão e status. |
| `RUN_INTEGRATION=true DATABASE_URL=postgres://oficina:oficina_local@localhost:5432/oficina bun run test:coverage` | 16 testes passaram; 0 falharam. Inclui os testes em memória, regras de domínio e testes de integração contra PostgreSQL ativo. |
| Cobertura dos arquivos de domínio e aplicação | 99,83% de linhas e 100% de funções; limiar configurado de 80%. `application/errors.ts` foi excluído da medição por conter somente o tipo de erro e sua construção; o mapeamento HTTP de erros está na camada `presentation`, também fora desse limiar. |
| `bun run security:audit` | Nenhuma vulnerabilidade reportada nas dependências; ver `docs/security/dependency-audit.md`. |
| `docker compose up --build -d` | Build da arquitetura DDD concluído em 2026-09-29; API iniciou e `/health` respondeu 200 com PostgreSQL conectado. |
| Fluxo via API no container | Login, consulta de catálogos, criação do orçamento usando CPF, transições, consulta pública, aprovação, reparo adicional com novo orçamento/aprovação, baixa correta de estoque, finalização e entrega passaram. |
| Swagger e autenticação | `/openapi` respondeu 200; rota administrativa sem JWT respondeu 401. |
| CORS | Preflight para `http://localhost:5173` retornou a origem configurada. |
| Coleção Insomnia | JSON válido; 43 requisições abrangem as 35 operações atualmente publicadas no OpenAPI, incluindo as duas rotas de oficina. |

Os testes de integração só são executados com `RUN_INTEGRATION=true`; sem essa variável, Bun os marca como ignorados e executa os testes unitários. `test:memory` executa isoladamente em `tests/` sem ler a configuração de cobertura do projeto.


## Revisão de DDD e Event Storming — 02/10/2026

- Oito etapas em SVG/Mermaid/Markdown e visualizador offline em `docs/ddd/event-storming/index.html`; rota local `/event-storming/`.
- Persistência completa do agregado WorkOrder; handlers separados para diagnóstico, apresentação, aprovação, rejeição, adicional, finalização e entrega.
- VOs Quote/QuoteVersion/StockBalance e igualdade/congelamento dos VOs existentes; saldo alterado por comportamento de Part.
- Eventos de OS e estoque registrados no mesmo UnitOfWork da mudança, tanto PostgreSQL quanto in-memory.
- `bun run typecheck`: concluído sem erros.
- `bun run test:memory`: 2 testes passaram. Verificação de rollback dos eventos e estoque; rejeição; versão antiga; retomada sem consumo duplicado.
- `RUN_INTEGRATION=true DATABASE_URL=postgres://oficina:oficina_local@localhost:5432/oficina bun run test:coverage`: 18 testes passaram, nenhum erro; 99,86% de linhas e 100% de funções nos arquivos incluídos no relatório. Infraestrutura e apresentação são excluídas da medição, mas os quatro testes de API exercitam os adaptadores PostgreSQL.
- Na primeira execução integrada foi detectado erro de serialização de Date no DAO. A conversão para ISO resolveu o erro; a suíte integrada foi executada novamente com sucesso.
- Docker Compose reconstruído; migração 0003 e seed aplicados; `/health` e `/event-storming/` retornaram HTTP 200.
- Revisão visual no navegador: navegação entre etapas 4 e 7, renderização de post-its/legenda, entidades/VOs, escala legível e ajuste de largura.
- A coleção Insomnia foi atualizada com `quote_version`; não foi importada manualmente no aplicativo nesta revisão.
- Não houve nova análise de vulnerabilidades nesta revisão. Não há publicação de link externo, broker, Event Sourcing, notificações ou suporte multiunidade.

## Exclusões em cascata — 14/10/2026

- `bun run typecheck`: concluído sem erros.
- `bun run test:coverage`, sem integração: 20 testes passaram; 14 cenários/hooks de integração foram ignorados; nenhuma falha. Cobertura de 99,86% de linhas e 100% de funções nos arquivos medidos. Infraestrutura, apresentação e suporte de testes ficam fora da medição; o limiar de 80% foi mantido.
- `RUN_INTEGRATION=true DATABASE_URL=postgres://oficina:oficina_local@127.0.0.1:5432/oficina bun --cwd=tests test cascade-deletions.integration.test.ts`: 8 testes passaram; nenhuma falha. Inclui cliente/veículo com múltiplas OS, preservação de catálogo e estoque, exclusão repetida, consultas, rollback, atualização de banco com dados existentes, reaplicação da migração e SQL direto.
- Os cenários específicos de cascata criam schemas exclusivos em transações revertidas ao final, inclusive as mudanças de schema.
- `RUN_INTEGRATION=true DATABASE_URL=postgres://oficina:oficina_local@127.0.0.1:5432/oficina bun run test:coverage`: 32 testes passaram, 0 falhas e 295 verificações; inclui os quatro testes HTTP existentes. Cobertura: 99,86% de linhas e 100% de funções nos arquivos medidos.
- Migração `0004_cascade_deletions.sql` aplicada no PostgreSQL local. Nenhum registro existente foi excluído pela migração.
- Coleção Insomnia validada como JSON, com IDs únicos e descrições das duas exclusões em cascata. Não foi importada manualmente no aplicativo nesta revisão.
- Build da imagem Docker concluído. O início do contêiner da API encontrou a porta 3000 ocupada por `bun --watch src/index.ts` do próprio projeto. Essa execução já ativa foi verificada: `/health` respondeu 200 com banco conectado e `/openapi/json` apresentou as duas rotas de cascata atualizadas.
- Não houve nova análise de vulnerabilidades nesta revisão.

## Cobertura mínima de 90% e integrações obrigatórias — 19/10/2026

Esta revisão substitui o limiar de 80% e a seleção opcional de integrações descritos nos registros históricos acima.

- `bunfig.toml`: limiar de **90% em linhas e funções por arquivo medido**. O escopo de medição foi preservado, incluindo infraestrutura e apresentação.
- Removidos os três `describe.skipIf` e a condição `RUN_INTEGRATION`. `bun test`, `bun run test` e os comandos de cobertura executam todas as integrações com PostgreSQL real. Banco indisponível causa falha explícita.
- Adicionados três testes para inicialização do estado, sequências de IDs independentes, cópia de contêineres e isolamento de sessões live/snapshot. O comando `test:unit` também os inclui.
- Construtores explícitos dos adaptadores de consultas, serviços, oficinas e do store mantêm a injeção/inicialização testável e permitem que o Bun contabilize essas funções corretamente.

| Verificação executada | Resultado |
| --- | --- |
| `bun run typecheck` | Aprovado. |
| `bun run mocks:check` | 9 portas e 29 métodos sincronizados. |
| `bun run test:unit` | 141 testes passaram, 0 falhas. Não requer PostgreSQL. |
| `DATABASE_URL=postgres://oficina:oficina_local@127.0.0.1:5432/oficina bun run test` | 200 testes passaram, 0 falhas, nenhum teste pulado; 1.447 asserções. |
| `DATABASE_URL=postgres://oficina:oficina_local@127.0.0.1:5432/oficina bun test --coverage` | 200 testes passaram, 0 falhas, nenhum teste pulado. |
| `DATABASE_URL=postgres://oficina:oficina_local@127.0.0.1:5432/oficina bun run test:coverage` | 200 testes passaram, 0 falhas, nenhum teste pulado; 1.447 asserções em 13 arquivos. Código de saída 0. |
| Resumo `All files` do Bun 1.3.8 | **100% das linhas e 99,61% das funções**. |
| Verificação de cada linha do relatório de cobertura | Todos os **102 arquivos medidos** têm pelo menos 90% em linhas e funções; menor cobertura de funções: 90%. |

Saída completa: [cobertura-90-2026-10-19.txt](cobertura-90-2026-10-19.txt). Comandos, matriz e exclusões: [estratégia de testes](../testing/README.md). Para executar as integrações, mantenha o PostgreSQL do Compose ativo; não é necessário migrar ou popular os dados de demonstração. Cada cenário usa schema próprio com rollback.

## Pipeline GitHub Actions e SonarQube — 19/10/2026

Validação local do código do workflow, antes de publicação no GitHub:

- A configuração de `origin/main` foi atualizada com `git fetch` e conferida: projeto Sonar `oficina-tech-challenge`, cobertura LCOV e perfil Docker `sonar` existentes foram reutilizados.
- `.github/workflows/quality.yml` validado pelo `actionlint` v1.7.12, sem erros. Actions fixadas por SHA e imagens Sonar do CI fixadas por digest.
- `bun install --frozen-lockfile`, `bun run typecheck` e `bun run mocks:check`: aprovados.
- `bun run test:coverage --reporter=junit --reporter-outfile=coverage/junit.xml`: **201 testes passaram**, nenhum teste pulado, nenhuma falha, 1.450 asserções.
- `python3 scripts/ci/check_coverage.py`: aprovado. 102 arquivos medidos; todos com pelo menos 90% em linhas/funções. Cobertura global calculada dos contadores LCOV: **100% das linhas e 99,03% das funções**, estritamente acima de 90%. Essa agregação pode diferir do resumo `All files` do Bun.
- `python3 -m unittest discover -s scripts/ci -p 'test_*.py'`: **14 testes passaram**, incluindo reprovação de cobertura insuficiente, relatórios vazios/inválidos, testes pulados/falhos, bootstrap restrito à instância descartável e exportação sem credenciais.
- SonarQube Community Build **26.10.0.133078** iniciado em um projeto Docker isolado, com PostgreSQL e volumes próprios. Bootstrap real concluiu troca de senha, criação do projeto, cópia do `Sonar way`, associação do gate e geração de token temporário.
- SonarScanner CLI **8.1.0.6389** executado com `sonar.qualitygate.wait=true`: **EXECUTION SUCCESS / QUALITY GATE STATUS: PASSED**. Gate global: cobertura de linhas 100%, bugs 0, vulnerabilidades 0. Total final de achados: **0**.
- Relatórios finais reais: [Quality Gate](ci-2026-10-19/quality-gate.json), [métricas](ci-2026-10-19/metrics.json) e [achados](ci-2026-10-19/issues.json).

A primeira análise identificou seis achados. Foram removidos defaults de senha no código de conexão/migração/seed, reutilizada a conexão central, utilizado o valor validado de `Quantity` e acrescentado teste explícito do rollback de schemas ao arquivo que registra o contrato compartilhado. Não houve supressão de regras ou exclusão desses arquivos da análise. O seed agora exige `ADMIN_PASSWORD` do ambiente; os exemplos locais continuam no Compose e `.env.example`.

Foram também tratados reset de conexão durante a inicialização do servidor e permissões do diretório de trabalho do scanner. A análise final passou em uma instância recriada do zero, inclusive com critérios globais de zero bugs/vulnerabilidades que não dependem de histórico de novo código.

O workflow ainda não foi executado na infraestrutura do GitHub e a proteção da `main` não foi alterada. Após publicar, exija o check **Quality Gate** no ruleset/proteção de branch. Instruções e limites: [pipeline de qualidade](../testing/ci.md). A análise local usou o working tree com alterações ainda não commitadas; os avisos de SCM não impediram a análise. Não houve nova auditoria de dependências com `bun audit` nesta revisão.

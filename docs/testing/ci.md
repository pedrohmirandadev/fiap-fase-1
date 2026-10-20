# GitHub Actions: testes, cobertura e SonarQube

O workflow `.github/workflows/quality.yml` executa em pull requests destinados à `main`, pushes na `main` e execução manual por `workflow_dispatch`.

## Checks

| Check | O que exige |
| --- | --- |
| Testes e cobertura | Bun 1.3.8, instalação com lockfile congelado, TypeScript válido, mocks sincronizados, testes do validador e suíte completa com PostgreSQL 17 saudável |
| Validação LCOV/JUnit | Nenhum teste pulado, falha ou erro; relatório não vazio; pelo menos 90% de linhas e funções por arquivo medido; totais globais de linhas e funções **estritamente maiores que 90%** |
| SonarQube | Análise do projeto `oficina-tech-challenge`, importação do LCOV e aprovação do Quality Gate |
| Quality Gate | Testes/cobertura e SonarQube precisam terminar com sucesso; um job falho, pulado ou cancelado reprova o check final |

O Bun aplica o limiar configurado em `bunfig.toml`. `scripts/ci/check_coverage.py` verifica também os contadores brutos do LCOV, os totais globais e o JUnit; relatório ausente, inválido ou incompleto reprova a etapa. O percentual global é calculado a partir dos contadores, podendo diferir da agregação `All files` exibida pelo Bun.

O PostgreSQL dos testes é um serviço efêmero do Actions. Os testes criam schemas próprios e aplicam migrações; não precisam da API em execução ou do seed. O CI não usa `RUN_INTEGRATION`, `continue-on-error` nem condições para omitir integrações.

## SonarQube sem secrets externos

O job reutiliza o perfil `sonar` do `docker-compose.yml`, que já existe na `main`. `.github/sonar-ci.compose.yml` fixa as imagens do servidor e scanner por digest apenas no CI. As actions também são fixadas por SHA.

Cada execução:

1. Baixa o LCOV e JUnit gerados pelo job de testes.
2. Prepara os limites do host Linux e sobe SonarQube com seu PostgreSQL em um projeto Compose exclusivo.
3. Aguarda o status `UP`, troca a senha inicial por uma senha aleatória e cria o projeto definido em `sonar-project.properties`.
4. Copia o Quality Gate `Sonar way`, preservando suas condições, adiciona cobertura geral de linhas de 90%, zero bugs e zero vulnerabilidades no código completo e associa o gate ao projeto.
5. Gera um token temporário de análise do projeto, mascara seu valor nos logs e o disponibiliza somente para o job. Não é necessário cadastrar `SONAR_TOKEN`, `SONAR_HOST_URL` ou senha no GitHub.
6. Executa o scanner e aguarda o Quality Gate com `sonar.qualitygate.wait=true`. Falha na análise, timeout ou reprovação do gate faz o job falhar. [Documentação oficial do Quality Gate no CI](https://docs.sonarsource.com/sonarqube-community-build/analyzing-source-code/ci-integration/overview).
7. Exporta relatórios e encerra os serviços com remoção dos volumes temporários, inclusive após falhas.

`sonar-project.properties` classifica os testes de domínio em `src/` como testes, mantendo-os fora do código de produção. As exclusões de cobertura dos quatro pontos de entrada são as mesmas do Bun.

A instância é descartável: não preserva histórico entre execuções e o dashboard deixa de existir ao encerrar o job. O Community Build recebe uma análise do código da execução, sem parâmetros de branch/PR exclusivos de outras edições. As condições de novo código do `Sonar way` dependem das métricas disponíveis na primeira análise; as condições globais adicionadas verificam cobertura, bugs e vulnerabilidades mesmo sem baseline, e o validador LCOV sempre exige o percentual definido.

## Evidências

Os artefatos ficam disponíveis na execução do Actions por 14 dias:

- `test-reports`: `lcov.info` e `junit.xml`, inclusive quando uma etapa de testes falha e o relatório foi gerado.
- `sonar-reports`: logs dos serviços, `report-task.txt` quando disponível, `quality-gate.json`, `metrics.json` e `issues.json`. O arquivo de achados contém os primeiros 100 resultados e o total retornado pela API.

O resumo do job de testes mostra a contagem de testes, número de arquivos e cobertura calculada a partir do LCOV. Se o scanner falhar antes de publicar uma análise, os relatórios Sonar podem não existir; os logs são preservados.

## Bloqueio de merge

Após publicar o workflow e executar a primeira pipeline, configure uma regra de proteção ou ruleset para `main` no GitHub e exija o status check **Quality Gate**. Esse check final só fica verde quando os dois jobs anteriores passam. A criação do YAML não altera automaticamente as regras de proteção do repositório. [Configuração oficial de checks obrigatórios](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).

## Reproduzir as verificações localmente

```bash
bun install --frozen-lockfile
bun run typecheck
bun run mocks:check
python3 -m unittest discover -s scripts/ci -p 'test_*.py'
docker compose up -d db
mkdir -p coverage
bun run test:coverage --reporter=junit --reporter-outfile=coverage/junit.xml
python3 scripts/ci/check_coverage.py
```

Para análise no seu SonarQube local persistente, continue usando as instruções `test:sonar` e `sonar:scan` do README. Os scripts `bootstrap_sonar.py` e `export_sonar.py` são exclusivos da instância descartável do CI; não os execute contra uma instalação com dados que deseja preservar.

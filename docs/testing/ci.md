# GitHub Actions: testes, cobertura e SonarQube

O workflow `.github/workflows/quality.yml` roda em pull requests para `main`, em pushes para `main` e quando alguém o inicia manualmente por `workflow_dispatch`.

## Checks

| Check | O que exige |
| --- | --- |
| Testes e cobertura | Bun 1.3.8, instalação com lockfile congelado, TypeScript válido, mocks sincronizados, testes do validador e suíte completa com PostgreSQL 17 saudável |
| Validação LCOV/JUnit | Nenhum teste pulado, falha ou erro; relatório não vazio; pelo menos 90% de linhas e funções por arquivo medido; totais globais de linhas e funções **estritamente maiores que 90%** |
| SonarQube | Análise do projeto `oficina-tech-challenge`, importação do LCOV e aprovação do Quality Gate |
| Quality Gate | Testes/cobertura e SonarQube precisam terminar com sucesso; um job falho, pulado ou cancelado reprova o check final |

O Bun aplica o limiar de `bunfig.toml`. `scripts/ci/check_coverage.py` também confere os contadores LCOV, os totais e o JUnit. A etapa falha se algum relatório estiver ausente, inválido ou incompleto. O script calcula o percentual global a partir dos contadores, então o resultado pode diferir da linha `All files` do Bun.

O Actions cria um PostgreSQL temporário para os testes. Cada cenário cria seu schema e aplica as migrações; a API e o seed não precisam estar ativos. O CI não usa `RUN_INTEGRATION`, `continue-on-error` ou condições que deixem integrações de fora.

## SonarQube sem secrets externos

O job usa o perfil `sonar` do `docker-compose.yml`, que já está na `main`. No CI, `.github/sonar-ci.compose.yml` fixa os digests das imagens do servidor e do scanner. As actions também usam SHA fixo.

Em cada execução, o job:

1. Baixa o LCOV e o JUnit do job de testes.
2. Configura os limites do host Linux e inicia o SonarQube e seu PostgreSQL em um projeto Compose exclusivo.
3. Espera o servidor chegar a `UP`, troca a senha inicial por uma senha aleatória e cria o projeto descrito em `sonar-project.properties`.
4. Copia o Quality Gate `Sonar way` com suas condições, acrescenta 90% de cobertura global de linhas e zero bugs e vulnerabilidades no código e associa o gate ao projeto.
5. Gera um token temporário de análise, oculta seu valor nos logs e o entrega apenas ao job. O GitHub não precisa armazenar `SONAR_TOKEN`, `SONAR_HOST_URL` ou senha.
6. Executa o scanner e aguarda o Quality Gate por `sonar.qualitygate.wait=true`. O job falha se a análise falhar, exceder o tempo ou não passar no gate. Consulte a [documentação oficial do Quality Gate no CI](https://docs.sonarsource.com/sonarqube-community-build/analyzing-source-code/ci-integration/overview).
7. Exporta os relatórios e remove os serviços e volumes temporários, inclusive quando uma etapa falha.

`sonar-project.properties` marca os testes de domínio em `src/` como testes, fora do código de produção. O SonarQube também usa as mesmas exclusões de cobertura que o Bun para os quatro pontos de entrada.

O job remove a instância ao terminar. Ela não guarda histórico entre execuções, e o dashboard deixa de existir quando o job encerra. O Community Build analisa o código daquela execução, sem os parâmetros de branch e PR disponíveis em outras edições. As condições de novo código do `Sonar way` dependem das métricas da primeira análise. As condições globais verificam cobertura, bugs e vulnerabilidades mesmo sem um baseline; o validador LCOV sempre exige o percentual configurado.

## Evidências

O Actions mantém estes artefatos por 14 dias:

- `test-reports`: `lcov.info` e `junit.xml`, inclusive quando uma etapa de testes falha e o relatório foi gerado.
- `sonar-reports`: logs dos serviços, `report-task.txt` quando disponível, `quality-gate.json`, `metrics.json` e `issues.json`. O arquivo de achados contém os primeiros 100 resultados e o total retornado pela API.

O resumo do job mostra quantos testes rodaram, quantos arquivos foram medidos e a cobertura calculada pelo LCOV. Se o scanner falhar antes de publicar a análise, os relatórios Sonar podem não ser criados; os logs continuam disponíveis.

## Bloqueio de merge

Depois de publicar o workflow e executar a primeira pipeline, configure uma regra de proteção ou ruleset para `main` e exija o status check **Quality Gate**. O check final passa somente quando os dois jobs anteriores passam. Adicionar o YAML não muda as regras de proteção do repositório. Consulte a [configuração oficial de checks obrigatórios](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).

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

Para analisar o projeto no SonarQube local e manter os dados entre execuções, siga as instruções `test:sonar` e `sonar:scan` do README. Os scripts `bootstrap_sonar.py` e `export_sonar.py` pertencem ao SonarQube temporário do CI. Não os rode numa instalação cujo histórico você queira preservar.

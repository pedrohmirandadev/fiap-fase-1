# Auditoria de dependências

- Evidência registrada em: 2026-09-28.
- Ferramenta: Bun 1.3.8 (`bun audit`).
- Escopo: dependências declaradas no `package.json` e lockfile `bun.lock`.
- Resultado observado: `No vulnerabilities found` (código de saída 0).

Esse resultado vale para as dependências consultadas naquela data. O workflow `Dependency audit` roda em pull requests para `main`, em pushes para `main` e quando iniciado manualmente. Cada execução guarda a saída como artefato por 14 dias. Confira o resultado mais recente antes da entrega.

Em 2026-10-25, uma nova execução local identificou a vulnerabilidade GHSA-mrhx-c7xc-m3w5 na versão de Zod abaixo de 4.6.6. A dependência foi atualizada para 4.6.7; a execução seguinte de `bun run security:audit` terminou sem vulnerabilidades.

O scanner verifica as dependências do projeto. Ele não analisa imagens Docker, configuração de infraestrutura, segredos ou código da aplicação.

## Execução atual - 2026-10-30

- Repositório: `https://github.com/pedrohmirandadev/fiap-fase-1`.
- Versão analisada: branch `main`, commit `a8ae42c2277fcb7457e7ef905c77b33a093f68ad`.
- Ferramenta: Bun 1.4.4 (`38afee6c8`), comando `bun audit`.
- Resultado observado: `No vulnerabilities found (checked 30 packages)`; código de saída 0.

O scanner leu o `bun.lock` desse commit. Essa auditoria não cobre o código da aplicação, imagens de container, configuração de implantação ou histórico Git. A revisão estática de autenticação, rotas e configuração está no [relatório de vulnerabilidades](vulnerability-report.md).

Referência da ferramenta: [Bun audit](https://bun.sh/docs/pm/cli/audit).

# Evidência de testes e cobertura — 30/10/2026

Execução feita na árvore local atual do projeto, com Bun 1.4.4 e PostgreSQL 17 local. O endereço de conexão e qualquer credencial foram mantidos fora deste documento.

| Verificação | Resultado |
| --- | --- |
| Comando | `bun run test:coverage` |
| Testes | 209 passaram; 0 falharam; nenhum foi ignorado |
| Asserções | 1.476 |
| Arquivos medidos | 105 |
| Cobertura global de linhas | 99,93% (1.531 de 1.532) |
| Cobertura global de funções | 100% (422 de 422) |
| Arquivos abaixo do limite configurado | 0; cada arquivo atingiu pelo menos 90% em linhas e funções |

O comando executou as integrações com PostgreSQL real. A suíte incluiu o teste de configuração JWT que confirma a rejeição de chave ausente ou com menos de 32 caracteres, além dos fluxos HTTP, persistência, migrações e cascatas. O limiar de 90% por arquivo, definido em `bunfig.toml`, supera os 80% solicitados para o desafio.

Essa evidência registra a execução local de 30/10/2026 sobre o código do commit `5affff0`, na branch `feat/fiap-fase1-pdf-requirements`. Quando a branch for publicada, confirme o CI e a revisão da PR antes de considerar essa versão final para avaliação.

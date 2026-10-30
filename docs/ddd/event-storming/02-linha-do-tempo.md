# 02: Linha do tempo

Esta etapa ordena os acontecimentos e mostra caminhos alternativos e ciclos.

[Visualizador](index.html) · [SVG](02-linha-do-tempo.svg) · [Mermaid](02.mmd) · [Índice](../README.md)

![Quadro da etapa 2](02-linha-do-tempo.svg)

No caminho principal, o grupo cadastra cliente, veículo e catálogo; recebe a OS, calcula o orçamento, inicia o diagnóstico e apresenta a proposta. Depois da aprovação, a equipe começa o reparo, finaliza a OS e entrega o veículo.

Quando o cliente rejeita o orçamento, o sistema registra a decisão e mantém a OS em espera. Um reparo adicional pausa a execução, atualiza o orçamento e pede outra decisão. A nova aprovação retoma o trabalho. A aprovação e o consumo de estoque pertencem à mesma transação. Entradas e saídas manuais podem ocorrer fora desse fluxo.

O quadro mostra a ordem lógica do negócio; não representa durações nem a ordem das chamadas HTTP. As setas tracejadas marcam caminhos condicionais ou retornos. A conferência de disponibilidade na criação não reserva as peças.

O resultado é um mapa do fluxo principal, da rejeição e do ciclo de reparo adicional, com a dependência do estoque indicada.

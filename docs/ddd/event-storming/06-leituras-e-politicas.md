# 06: Modelos de leitura e políticas

Esta etapa mostra quais informações orientam uma decisão e quais condições permitem a ação.

[Visualizador](index.html) · [SVG](06-leituras-e-politicas.svg) · [Mermaid](06.mmd) · [Índice](../README.md)

![Quadro da etapa 6](06-leituras-e-politicas.svg)

Os post-its ML representam consultas de cadastros, catálogo, saldo, movimentações, fila de OS, detalhes administrativos e acompanhamento público. A consulta pública retorna o total e `quoteVersion`. Uma integração nova deve enviar essa versão ao aprovar o orçamento.

As políticas exigem que a OS use um veículo do cliente e guarde uma cópia do preço e da descrição do catálogo. O sistema confere a disponibilidade ao criar a OS e consome as peças somente após a aprovação. Um reparo adicional pausa a execução; ao retomá-la, a API consome apenas os itens ainda pendentes. O saldo não pode ficar negativo e o serviço não pode começar sem aprovação.

Os agregados e handlers aplicam essas políticas de forma síncrona. O sistema não tem serviço de notificações, consumidor de eventos nem atualização assíncrona dos modelos de leitura. O tempo médio é uma consulta analítica e não altera dados.

O resultado liga leitura, decisão, comando e as regras de cada ramificação.

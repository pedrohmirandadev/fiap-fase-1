# 03: Pontos de atenção e decisões

Esta etapa registra as perguntas que afetam cada parte do fluxo.

[Visualizador](index.html) · [SVG](03-pontos-de-atencao.svg) · [Mermaid](03.mmd) · [Índice](../README.md)

![Quadro da etapa 3](03-pontos-de-atencao.svg)

Os losangos PA mostram as dúvidas sobre reserva de estoque, rejeição, versão do orçamento, reparo adicional, concorrência, notificações, tempo médio e multiunidade. O quadro marca cada questão como decidida ou em aberto. Quando o grupo escolhe uma solução, registre também seus limites.

O resultado reúne decisões justificadas e perguntas ainda pendentes. Consulte o [registro completo](../decisoes.md).

| ID | Pergunta | Decisão / situação |
|---|---|---|
| H01 | Reserva ou conferência? | Decidido: criação confere; não reserva. Aprovação confere novamente e consome atomicamente. |
| H02 | Rejeição cancela a OS? | Decidido: mantém AWAITING_APPROVAL, registra decisão e não consome estoque. Cancelamento não está no MVP. |
| H03 | Qual orçamento foi aprovado? | Decidido: decisões guardam versão e total. quoteVersion é obrigatório; uma versão desatualizada é recusada. |
| H04 | Reparo adicional pode executar? | Decidido: pausa e incrementa versão. Aprovação nova consome apenas peças ainda não consumidas. |
| H05 | Duas OS disputam a última peça? | Decidido: lock, versão otimista de Part e rollback conjunto de OS, saldo, movimentos e eventos. |
| H06 | Como o cliente é notificado? | Em aberto: não há email/SMS. O orçamento e o progresso são consultados pelo código público. |
| H07 | Como medir a execução? | Decidido: primeira aprovação até finalização, incluindo pausas. Não representa só horas de trabalho ativo. |
| H08 | A oficina possui várias unidades? | Em aberto: Workshop é cadastro único lógico; OS ainda não possui workshopId. Multiunidade não está implementada. |

# DDD e Event Storming da oficina

O Event Storming está dividido em oito etapas e ligado ao código do projeto. Os quadros explicam o fluxo do negócio, as regras dos agregados e o caminho de cada intenção até sua implementação.

## Abrir os quadros

- O [quadro externo de DDD e Event Storming no Miro](https://miro.com/app/board/uXjVEXyyV68=/?share_link_id=376913126076) abre em modo somente leitura sem pedir acesso.
- Com a API em execução, abra **http://localhost:3000/event-storming/**.
- Sem API ou rede, abra `event-storming/index.html` no navegador. O visualizador inclui os oito SVGs e não usa CDN.
- Cada etapa tem um SVG, uma fonte Mermaid e uma explicação em Markdown. Use zoom e barras de rolagem para ler os quadros. A impressão usa a etapa selecionada.
- Para gerar os quadros após editar o catálogo em `scripts/generate-event-storming.py`, execute `python3 scripts/generate-event-storming.py`. O script atualiza `catalogo.json`, os SVGs, os arquivos Mermaid e o HTML de forma determinística.

| Etapa | Objetivo | Material |
|---|---|---|
| 1 | Levantar fatos antes de organizar | [Descoberta livre](event-storming/01-descoberta.md) |
| 2 | Organizar o caminho e as alternativas no tempo | [Linha do tempo](event-storming/02-linha-do-tempo.md) |
| 3 | Identificar dúvidas, riscos e decisões | [Pontos de atenção](event-storming/03-pontos-de-atencao.md) |
| 4 | Marcar mudanças de fase do processo | [Eventos pivotais](event-storming/04-eventos-pivotais.md) |
| 5 | Identificar quem pede o quê | [Atores e comandos](event-storming/05-atores-e-comandos.md) |
| 6 | Mostrar informações para decidir e políticas | [Leituras e políticas](event-storming/06-leituras-e-politicas.md) |
| 7 | Definir consistência, raízes, entidades e VOs | [Agregados](event-storming/07-agregados.md) |
| 8 | Delimitar linguagem, responsabilidade e integração | [Bounded contexts](event-storming/08-bounded-contexts.md) |

Os quadros cobrem os três fluxos do desafio: criar a OS, acompanhar e decidir o orçamento, e gerenciar peças e insumos. Eles registram 29 fatos. O sistema persiste 17 tipos de eventos em envelopes e mantém o estado de 12 fatos de cadastro sem envelope próprio. Consultas, falhas e funções futuras não aparecem como eventos de sucesso implementados.

## Notação e conceitos

| Sigla/cor | Conceito | Significado |
|---|---|---|
| EV / amarelo | Evento de domínio | Algo ocorrido, nomeado no passado. E01 a E17 são `DomainEvent`; C01 a C12 são fatos de cadastro sem registro em `domain_events`. |
| CMD / azul turquesa | Comando | Intenção que pode ser aceita ou rejeitada: aprovar orçamento, finalizar reparo. |
| AT / amarelo claro | Ator | Papel que inicia uma ação: cliente, atendente, equipe técnica, estoquista. A API administrativa usa um único papel JWT no MVP. |
| ML / verde | Modelo de leitura | Informação para decidir: orçamento público, fila de OS, saldo e movimentos. |
| POL / lilás | Política | Regra/condição que orienta uma decisão ou reação. É síncrona neste monólito; não há consumidor automático de mensagens. |
| PA / rosa | Ponto de atenção | Dúvida ou risco. O catálogo declara a decisão tomada ou o que permanece aberto. |
| D / losango lilás | Decisão | Ramificação do processo, como aprovar ou rejeitar. |
| AG / amarelo claro | Agregado | Unidade de consistência protegida pela raiz; não é uma camada ou uma tabela. |
| ENT / azul claro | Entidade | Tem identidade e continuidade, como `WorkOrderItem` dentro da OS. |
| VO / lavanda | Objeto de valor | Não tem identidade própria; é validado, imutável e comparado por conteúdo. |
| ★ / borda espessa | Evento pivotal | Fato que muda a fase do processo. |

O ator consulta informações e envia um comando. O handler carrega a raiz; o comportamento valida as invariantes e o repositório persiste o agregado. Os eventos são registrados na mesma transação. Entidades internas não enviam comandos HTTP à raiz: a própria raiz controla seus filhos.

## Linguagem ubíqua

| Termo | Significado no projeto | Código |
|---|---|---|
| OS | Atendimento/reparo de um veículo de um cliente | `WorkOrder` |
| Orçamento | Total dos snapshots de preço e quantidade dos itens de uma versão | `Quote`, `Money`, `QuoteVersion` |
| Decisão | Aceite/rejeição de uma versão e de seu total | `QuoteDecision` |
| Reparo adicional | Novo item durante execução que pausa a OS e pede nova aprovação | `proposeAdditionalRepair` |
| Peça/insumo | Item de catálogo com saldo controlado | `Part`, `StockBalance` |
| Consumo | Saída vinculada a uma OS aprovada | `consumeForWorkOrder`, `InventoryMovement` |
| Acompanhamento | Consulta pública limitada pelo código imprevisível | `TrackingCode`, `WorkOrderQueries.publicView` |
| Tempo de execução | Primeira aprovação até finalização, incluindo pausas | `averageExecutionMinutes` |

Consulte o [modelo tático](modelo-tatico.md), as [decisões](decisoes.md) e a [rastreabilidade](rastreabilidade.md) para ver as regras e os caminhos do código.

## Fontes conceituais

Os nomes seguem a prática de [EventStorming](https://www.eventstorming.com/), a explicação de [eventos pivotais por Alberto Brandolini](https://www.avanscoperta.it/en/eventstorming/pivotal-events/) e as definições de [agregado](https://martinfowler.com/bliki/DDD_Aggregate.html), [objeto de valor](https://martinfowler.com/bliki/ValueObject.html) e [bounded context](https://martinfowler.com/bliki/BoundedContext.html). As decisões descritas nos quadros pertencem a este projeto.

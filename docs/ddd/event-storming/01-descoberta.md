# 01: Descoberta livre

Nesta etapa, o grupo lista os fatos do negócio antes de escolher uma solução.

[Visualizador](index.html) · [SVG](01-descoberta.svg) · [Mermaid](01.mmd) · [Índice](../README.md)

![Quadro da etapa 1](01-descoberta.svg)

Os post-its aparecem fora de ordem. Leia cada fato no passado, agrupe termos parecidos e confirme o significado com o grupo. O catálogo cobre recebimento, aprovação e rejeição, pausas, revisões, consumo, saldo e alterações cadastrais.

Nem todo fato precisa gerar uma mensagem. O código registra envelopes para E01 a E17. C01 a C12 representam mudanças de cadastro persistidas sem envelope próprio. Falha de estoque, consulta de progresso e notificações futuras não aparecem como eventos aceitos.

Ao concluir esta etapa, o catálogo contém 29 fatos, cada um com significado e origem. As perguntas em aberto seguem para a etapa 3.

## Catálogo de fatos

| ID | Fato | Raiz | Persistência |
|---|---|---|---|
| C01 | Oficina cadastrada (`WorkshopRegistered`) | Workshop | estado do cadastro; sem envelope |
| C02 | Cliente cadastrado (`CustomerRegistered`) | Customer | estado do cadastro; sem envelope |
| C03 | Contato do cliente alterado (`CustomerContactChanged`) | Customer | estado do cadastro; sem envelope |
| C04 | Veículo vinculado ao cliente (`VehicleRegistered`) | Vehicle | estado do cadastro; sem envelope |
| C05 | Dados do veículo alterados (`VehicleDetailsChanged`) | Vehicle | estado do cadastro; sem envelope |
| C06 | Serviço cadastrado (`ServiceRegistered`) | Service | estado do cadastro; sem envelope |
| C07 | Preço do serviço alterado (`ServicePriceChanged`) | Service | estado do cadastro; sem envelope |
| C08 | Serviço desativado (`ServiceDeactivated`) | Service | estado do cadastro; sem envelope |
| C09 | Peça cadastrada com saldo inicial (`PartRegistered`) | Part | estado do cadastro; sem envelope |
| C10 | Preço da peça alterado (`PartPriceChanged`) | Part | estado do cadastro; sem envelope |
| C11 | Estoque mínimo alterado (`MinimumStockChanged`) | Part | estado do cadastro; sem envelope |
| C12 | Peça desativada (`PartDeactivated`) | Part | estado do cadastro; sem envelope |
| E01 | OS recebida (`WorkOrderReceived`) | WorkOrder | DomainEvent |
| E02 | Orçamento calculado (`QuoteCalculated`) | WorkOrder | DomainEvent |
| E03 | Diagnóstico iniciado (`DiagnosisStarted`) | WorkOrder | DomainEvent |
| E04 | Orçamento apresentado (`QuoteSubmitted`) | WorkOrder | DomainEvent |
| E05 | Orçamento aprovado (`QuoteApproved`) | WorkOrder | DomainEvent |
| E06 | Orçamento rejeitado (`QuoteRejected`) | WorkOrder | DomainEvent |
| E07 | Execução iniciada (`ExecutionStarted`) | WorkOrder | DomainEvent |
| E08 | Reparo adicional proposto (`AdditionalRepairProposed`) | WorkOrder | DomainEvent |
| E09 | Execução pausada (`ExecutionPaused`) | WorkOrder | DomainEvent |
| E10 | Orçamento revisado (`QuoteRevised`) | WorkOrder | DomainEvent |
| E11 | Execução retomada (`ExecutionResumed`) | WorkOrder | DomainEvent |
| E12 | Reparo finalizado (`RepairFinished`) | WorkOrder | DomainEvent |
| E13 | Veículo entregue (`VehicleDelivered`) | WorkOrder | DomainEvent |
| E14 | Entrada de estoque registrada (`StockReceived`) | Part | DomainEvent |
| E15 | Saída manual registrada (`StockWithdrawn`) | Part | DomainEvent |
| E16 | Peças consumidas na OS (`PartsConsumed`) | Part | DomainEvent |
| E17 | Estoque mínimo atingido (`MinimumStockReached`) | Part | DomainEvent |

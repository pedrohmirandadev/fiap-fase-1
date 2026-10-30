# 05: Atores e comandos

Esta etapa liga cada intenção ao ator que a inicia e ao comportamento que a atende.

[Visualizador](index.html) · [SVG](05-atores-e-comandos.svg) · [Mermaid](05.mmd) · [Índice](../README.md)

![Quadro da etapa 5](05-atores-e-comandos.svg)

O quadro organiza as ações por intenção. O cliente aprova ou rejeita o orçamento. O atendente recebe OS e registra a entrega. A equipe técnica inicia o diagnóstico, apresenta o orçamento, propõe reparos adicionais e finaliza o serviço. O estoquista movimenta peças, e o administrador mantém o catálogo.

No MVP, os papéis internos usam a mesma credencial administrativa. O cliente consulta a OS pelo `TrackingCode`. Uma invariante pode rejeitar um comando; nesse caso, não há evento de sucesso.

O resultado mostra o ator, o comando, o handler e os eventos aceitos em cada intenção. Os handlers estão listados na [rastreabilidade](../rastreabilidade.md).

| Ator | Comando | Handler |
|---|---|---|
| Administrador | Cadastrar oficina | `CreateWorkshop` |
| Atendente | Cadastrar cliente | `CreateCustomer` |
| Atendente | Alterar contato | `UpdateCustomer` |
| Atendente | Vincular veículo | `CreateVehicle` |
| Atendente | Alterar dados do veículo | `UpdateVehicle` |
| Administrador | Cadastrar serviço | `CreateService` |
| Administrador | Alterar preço do serviço | `UpdateService` |
| Administrador | Desativar serviço | `DeactivateService` |
| Estoquista | Cadastrar peça | `CreatePart` |
| Administrador | Alterar preço da peça | `UpdatePart` |
| Estoquista | Definir estoque mínimo | `UpdatePart` |
| Estoquista | Receber estoque | `ReceiveStock` |
| Estoquista | Retirar estoque | `WithdrawStock` |
| Administrador | Desativar peça | `DeactivatePart` |
| Atendente | Receber OS | `CreateWorkOrder` |
| Equipe técnica | Iniciar diagnóstico | `StartDiagnosis` |
| Equipe técnica | Apresentar orçamento | `SubmitQuote` |
| Cliente | Aprovar orçamento | `ApproveQuote` |
| Cliente | Rejeitar orçamento | `RejectQuote` |
| Equipe técnica | Propor reparo adicional | `ProposeAdditionalRepair` |
| Cliente | Aprovar orçamento revisado | `ApproveQuote` |
| Equipe técnica | Finalizar reparo | `FinishRepair` |
| Atendente | Registrar entrega | `RecordDelivery` |
| Política de aprovação | Consumir peças aprovadas | `ApproveQuote / Part.consumeForWorkOrder` |

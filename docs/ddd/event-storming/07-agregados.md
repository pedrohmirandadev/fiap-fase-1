# 07: Agregados, entidades e objetos de valor

Esta etapa identifica a unidade de consistência que protege cada alteração.

[Visualizador](index.html) · [SVG](07-agregados.svg) · [Mermaid](07.mmd) · [Índice](../README.md)

![Quadro da etapa 7](07-agregados.svg)

Uma entidade tem identidade. Um objeto de valor (VO) tem conteúdo validado, é imutável e se compara pelo valor. O agregado é controlado por uma raiz e pode conter apenas essa raiz. `WorkOrder` controla `WorkOrderItem`, `QuoteDecision` e `StatusChange`; as referências a `Customer`, `Vehicle`, `Service` e `Part` usam IDs.

O quadro liga cada comando à raiz correspondente. Para persistir uma OS, o repositório salva a raiz e seus filhos. Ao alterar o saldo, `Part` produz uma nova peça, um `InventoryMovement` e eventos. Itens, decisões e histórico não têm repositórios independentes.

O quadro define limites de consistência, invariantes, entidades internas, VOs e repositórios. Consulte o [modelo tático completo](../modelo-tatico.md).

## Raízes, filhos e VOs

| Raiz | Entidades internas | VOs | Repositório |
|---|---|---|---|
| WorkOrder | WorkOrderItem, QuoteDecision, StatusChange | TrackingCode, Quote, QuoteVersion, Money, Quantity | WorkOrderRepository |
| Part | InventoryMovement (histórico) | Money, StockBalance, Quantity | PartRepository |
| Customer | nenhum | TaxDocument | CustomerRepository |
| Vehicle | nenhum | VehiclePlate | VehicleRepository |
| Service | nenhum | Money | ServiceRepository |
| Workshop | nenhum | TaxDocument | WorkshopRepository |
| AdminUser | nenhum | nenhum VO próprio | AdminUserRepository |

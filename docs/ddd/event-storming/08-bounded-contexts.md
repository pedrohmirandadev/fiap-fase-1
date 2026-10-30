# 08: Bounded contexts e integrações

Esta etapa delimita os modelos e as relações entre contextos.

[Visualizador](index.html) · [SVG](08-bounded-contexts.svg) · [Mermaid](08.mmd) · [Índice](../README.md)

![Quadro da etapa 8](08-bounded-contexts.svg)

- Relacionamento com clientes: identidade do cliente, vínculo e dados do veículo.
- Catálogo de serviços: serviços com preço; fornece um snapshot à OS.
- Peças e estoque: catálogo de peças, saldo e movimentações.
- Atendimento e reparo: OS, orçamento, decisão, execução e entrega.
- Identidade administrativa: credenciais e JWT para operações administrativas.
- Operação da oficina: dados da oficina; o suporte a várias unidades continua em aberto.

Atendimento usa IDs de cliente e veículo e snapshots do catálogo. Ao aprovar um orçamento, chama Estoque dentro do mesmo `UnitOfWork`. Identidade protege os comandos administrativos; o cliente usa o código público. Oficina não contém todos os clientes e OS em um único agregado.

Esses limites são lógicos dentro do monólito. Os módulos compartilham banco e composição; não são microsserviços e não têm ACLs independentes. O bloco "integração" mostra como os contextos existentes interagem, não representa um sétimo contexto.

O resultado é um mapa dos contextos e dos contratos de integração, com os limites atuais registrados.

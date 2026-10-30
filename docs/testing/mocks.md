# Mocks e fábricas de entidades

## Ambiente automático

`createMockEnvironment()` cria todos os repositórios, a consulta de OS, o registro de eventos, o UnitOfWork e entidades fictícias relacionadas. Mocks, IDs e dados ficam isolados naquela chamada. Crie um ambiente novo para cada teste.

```ts
import { expect } from 'bun:test';
import { GetCustomer } from '../src/application/use-cases/customer/get-customer';
import { createMockEnvironment } from './mocks';

const { repositories, fixtures } = createMockEnvironment();
repositories.customers.findById.mockResolvedValue(fixtures.customer);

const useCase = new GetCustomer(repositories.customers);
const customer = await useCase.execute(fixtures.customer.id!);

expect(customer).toEqual(fixtures.customer);
expect(repositories.customers.findById).toHaveBeenCalledWith(fixtures.customer.id);
```

Os imports dos exemplos consideram um arquivo em `tests/`.

### Portas disponíveis

| Propriedade | Contrato |
| --- | --- |
| `repositories.customers` | CustomerRepository |
| `repositories.vehicles` | VehicleRepository |
| `repositories.services` | ServiceRepository |
| `repositories.parts` | PartRepository |
| `repositories.workOrders` | WorkOrderRepository |
| `repositories.workshops` | WorkshopRepository |
| `repositories.users` | AdminUserRepository |
| `repositories.events` | DomainEventStore |
| `workOrderQueries` | WorkOrderQueries |
| `unitOfWork` | UnitOfWork |

Os métodos oferecem as APIs tipadas de `bun:test`: `mockResolvedValue`, `mockResolvedValueOnce`, `mockRejectedValue`, `mockImplementation` e inspeção de chamadas. Se um método não for configurado, a chamada falha com `Mock não configurado: NomeDaPorta.metodo`. Isso evita um retorno de sucesso implícito. Configure `undefined` para representar um registro ausente ou uma operação sem retorno.

```ts
const environment = createMockEnvironment();
environment.repositories.customers.findById.mockResolvedValue(undefined);
environment.repositories.events.append.mockResolvedValue(undefined);
environment.workOrderQueries.list.mockResolvedValue([]);
```

### Operações transacionais

O mock de UnitOfWork já executa o callback com os mesmos repositórios do ambiente. Configure as operações chamadas pelo caso de uso:

```ts
import { ReceiveStock } from '../src/application/use-cases/part/receive-stock';
import { createMockEnvironment } from './mocks';

const { repositories, unitOfWork, fixtures } = createMockEnvironment();
repositories.parts.findById.mockResolvedValue(fixtures.part);
repositories.parts.save.mockImplementation(async part => part);
repositories.parts.recordMovement.mockResolvedValue(undefined);
repositories.events.append.mockResolvedValue(undefined);

const updated = await new ReceiveStock(unitOfWork).execute({
  partId: fixtures.part.id!, quantity: 5, reason: 'Reposição de teste'
});
// updated.stockQuantity === 15; chamadas podem ser verificadas nos mocks.
```

Use esse mock para conferir a orquestração do caso de uso. Para testar persistência, cascata ou rollback com estado real, use `createInMemoryEnvironment()` ou os testes PostgreSQL isolados.

## Fábricas

`fixtures` contém `customer`, `vehicle`, `service`, `part`, `workshop`, `adminUser` e `workOrder` com relações coerentes. Também fornece `serviceItem`, `partItem`, `quoteDecision`, `statusChange` e `inventoryMovement`. A OS começa em `RECEIVED`. A decisão é um exemplo independente e ainda não pertence a essa OS.

Use `factories` para criar entidades com sobrescritas tipadas. Há uma fábrica para cada entidade, inclusive para os filhos dos agregados:

```ts
const { factories } = createMockEnvironment();
const customer = factories.customer({ name: 'Cliente adicional' });
const vehicle = factories.vehicle({ customerId: customer.id!, model: 'Fit' });
const part = factories.part({ stockQuantity: 0, active: false });
const newCustomer = factories.customer({ id: undefined });
const waitingOrder = factories.workOrder({ customerId: customer.id!, vehicleId: vehicle.id! })
  .startDiagnosis().submitQuote();
```

Os valores padrão usam IDs sequenciais, documentos e placas válidos, VOs reais e uma data fixa para os históricos. As entidades já recebem identidade; quando o ID é opcional, passe `id: undefined` para representar uma entidade nova. As transições da OS chamam os comportamentos do domínio. A fábrica sequencia IDs, documentos e placas; o teste controla qualquer sobrescrita explícita.

O hash do administrador usa bcrypt com custo reduzido para os testes. `FIXTURE_ADMIN_PASSWORD` é gerada aleatoriamente em cada processo e fica disponível às fixtures que precisam autenticar. O código de acompanhamento é previsível para facilitar comparações; use-o somente em testes.

Para gerar apenas dados, importe `createEntityFactories` ou `createRelatedFixtures` de `tests/factories`. `tests/mocks` também exporta funções para criar um mock isolado, como `createCustomerRepositoryMock()`.

## Limpeza e isolamento

- `clearMocks()` limpa as chamadas e resultados deste ambiente, preservando as configurações dos mocks.
- `resetMocks()` limpa chamadas, retornos configurados e filas de retornos únicos; reinstala o comportamento inicial, incluindo o callback do UnitOfWork.
- Para reiniciar entidades e sequências, crie outro ambiente.

## Geração automática a partir das interfaces

```bash
bun run mocks:generate
bun run mocks:check
bun run typecheck
```

O gerador usa o compilador TypeScript para ler `RepositoryContext`, as interfaces relacionadas e `WorkOrderQueries`. Ele grava os métodos em `tests/mocks/generated/`, junto com o registro e os exports. Rode-o novamente quando adicionar um repositório ao contexto ou um método a uma interface. As fábricas continuam explícitas para manter invariantes e relacionamentos.

`mocks:check` verifica a sincronização e falha quando encontra diferenças. O gerador altera somente os arquivos marcados como gerados nesse diretório. O UnitOfWork tem uma implementação própria para preservar o callback genérico.

Mocks e fábricas não entram na cobertura do código de produção. Os limiares de domínio e aplicação continuam iguais.

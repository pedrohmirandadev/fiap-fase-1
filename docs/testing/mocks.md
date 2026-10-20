# Mocks e fábricas de entidades

## Ambiente automático

`createMockEnvironment()` monta todos os repositórios, a consulta de OS, o registro de eventos, o UnitOfWork e um conjunto relacionado de entidades fictícias. Os mocks, as sequências de IDs e os dados pertencem à chamada; crie um ambiente novo em cada teste.

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

Cada método oferece as APIs tipadas de `bun:test`: `mockResolvedValue`, `mockResolvedValueOnce`, `mockRejectedValue`, `mockImplementation` e inspeção de chamadas. Uma chamada sem configuração rejeita com `Mock não configurado: NomeDaPorta.metodo`, evitando respostas de sucesso acidentais. Configure `undefined` explicitamente para representar ausência ou uma operação sem retorno.

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

Esse mock serve à orquestração do caso de uso. Para verificar persistência, cascata ou rollback com estado real, use `createInMemoryEnvironment()` ou os testes PostgreSQL isolados.

## Fábricas

`fixtures` contém customer, vehicle, service, part, workshop, adminUser e workOrder, com relacionamentos coerentes. Também inclui serviceItem, partItem, quoteDecision, statusChange e inventoryMovement. A OS começa em `RECEIVED`; a decisão fornecida é um exemplo independente e ainda não está registrada nessa OS.

`factories` permite criar novas entidades com sobrescritas tipadas. Há uma fábrica por entidade, incluindo os filhos de agregado:

```ts
const { factories } = createMockEnvironment();
const customer = factories.customer({ name: 'Cliente adicional' });
const vehicle = factories.vehicle({ customerId: customer.id!, model: 'Fit' });
const part = factories.part({ stockQuantity: 0, active: false });
const newCustomer = factories.customer({ id: undefined });
const waitingOrder = factories.workOrder({ customerId: customer.id!, vehicleId: vehicle.id! })
  .startDiagnosis().submitQuote();
```

Defaults usam IDs sequenciais, CPF/CNPJ válidos, placas válidas, VOs reais e data fixa para históricos. As entidades já têm identidade por padrão; nas entidades cujo ID é opcional, `id: undefined` representa uma entidade nova. As transições da OS usam os comportamentos do próprio domínio. IDs/documentos/placas são sequenciais dentro da fábrica; sobrescritas explícitas ficam sob controle do teste.

O hash do administrador é bcrypt válido com custo reduzido para testes; a senha padrão é exportada como `FIXTURE_ADMIN_PASSWORD`. O tracking code da fábrica é previsível para facilitar comparação e deve ser usado somente em testes.

Para criar apenas os dados, importe `createEntityFactories` ou `createRelatedFixtures` de `tests/factories`. Para um único repositório, há funções como `createCustomerRepositoryMock()` exportadas por `tests/mocks`.

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

O gerador usa o compilador TypeScript para ler `RepositoryContext`, suas interfaces referenciadas e `WorkOrderQueries`. Todos os métodos dessas portas são gerados em `tests/mocks/generated/`, junto com o registro e os exports. Ao adicionar um repositório ao contexto ou um método a uma interface, execute a geração novamente. As fábricas de entidades permanecem explícitas para respeitar invariantes e relacionamentos.

`mocks:check` apenas confere se os arquivos estão sincronizados e retorna erro se houver diferenças. O gerador altera somente arquivos identificados como gerados dentro desse diretório. O UnitOfWork tem implementação própria para preservar o callback genérico.

Mocks e fábricas ficam fora da cobertura do código de produção. Os limiares de domínio e aplicação permanecem os mesmos.

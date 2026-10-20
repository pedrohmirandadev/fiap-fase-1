import { Service } from '../../src/domain/service/service';
import { Money } from '../../src/domain/shared/value-objects';
import type { FactoryContext } from './factory-context';

type ServiceProps = Parameters<typeof Service.create>[0] & { id: number | undefined; active: boolean };

export function createServiceFactory(context: FactoryContext) {
  return (overrides: Partial<ServiceProps> = {}): Service => {
    const sequence = context.nextId('service');
    const props = { id: sequence, name: `Revisão ${sequence}`, description: 'Serviço fictício', priceCents: 18000,
      estimatedMinutes: 60, active: true, ...overrides };
    return new Service(props.id, props.name, props.description, new Money(props.priceCents), props.estimatedMinutes, props.active);
  };
}

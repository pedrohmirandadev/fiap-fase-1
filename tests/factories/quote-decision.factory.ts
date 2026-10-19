import { QuoteDecision } from '../../src/domain/work-order/quote-decision';
import { QuoteVersion } from '../../src/domain/work-order/quote-version';
import { Money } from '../../src/domain/shared/value-objects';
import type { FactoryContext } from './factory-context';

type DecisionProps = { id: number | undefined; approved: boolean; totalCents: number;
  reason: string | undefined; createdAt: Date; quoteVersion: number };

export function createQuoteDecisionFactory(context: FactoryContext) {
  return (overrides: Partial<DecisionProps> = {}): QuoteDecision => {
    const props = { id: context.nextId('quoteDecision'), approved: true, totalCents: 21500,
      reason: 'Decisão fictícia', createdAt: context.date(), quoteVersion: 1, ...overrides };
    return new QuoteDecision(props.approved, new Money(props.totalCents), props.reason,
      props.createdAt, new QuoteVersion(props.quoteVersion), props.id);
  };
}

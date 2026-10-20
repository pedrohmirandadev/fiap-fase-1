import { ItemKind } from '../../../domain/work-order/work-order-item';
import type { UnitOfWork } from '../../unit-of-work';
import { requireFound } from '../../require-found';
import { QuoteVersion } from '../../../domain/work-order/quote-version';
import { Quantity } from '../../../domain/shared/value-objects';

export interface ApproveQuoteCommand { readonly trackingCode: string; readonly quoteVersion?: number; readonly reason?: string }

export class ApproveQuote {
  constructor(private readonly unitOfWork: UnitOfWork) {}
  execute(command: ApproveQuoteCommand) {
    return this.unitOfWork.run(async context => {
      const order = requireFound(await context.workOrders.findByTrackingCode(command.trackingCode, true), 'OS');
      const changed = order.approveQuote(command.quoteVersion === undefined ? order.quoteVersion : new QuoteVersion(command.quoteVersion), command.reason);
      const pendingParts = new Map<number, number>();
      for (const item of order.items.filter(item => item.kind === ItemKind.Part && !item.consumed)) {
        pendingParts.set(item.catalogId, (pendingParts.get(item.catalogId) ?? 0) + item.quantity.value);
      }
      // Ordem consistente de locks evita que aprovações concorrentes travem em ordem inversa.
      for (const [partId, quantity] of [...pendingParts].sort(([a], [b]) => a - b)) {
        const part = requireFound(await context.parts.findById(partId, true), 'Peça');
        const change = part.consumeForWorkOrder(new Quantity(quantity), order.id!);
        await context.parts.save(change.part);
        await context.parts.recordMovement(change.movement);
        await context.events.append(change.events);
      }
      await context.workOrders.save(changed);
      await context.events.append(changed.pendingEvents);
      return { message: 'Orçamento aprovado; serviço iniciado', approved: true, quoteVersion: changed.quoteVersion.value };
    });
  }
}

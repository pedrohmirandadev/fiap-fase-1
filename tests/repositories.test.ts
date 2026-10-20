import { expect, it } from 'bun:test';
import { createInMemoryEnvironment } from '../src/infrastructure/in-memory/context';
import { registerRepositoryContract } from './support/repository-contract';
import { createEntityFactories } from './factories';

registerRepositoryContract('Contratos dos repositórios em memória', async check => {
  const e = createInMemoryEnvironment();
  await check({ ...e, addAdmin: async user => e.store.addAdminUser(user), events: async () => e.store.state.events });
});

it('transações em memória serializam gravações e continuam após rejeição', async () => {
  const e = createInMemoryEnvironment();
  const part = await e.repositories.parts.save(createEntityFactories().part({ id: undefined }));
  const change = () => e.unitOfWork.run(async c => {
    const current = (await c.parts.findById(part.id!))!;
    await Promise.resolve();
    await c.parts.save(current.receiveStock(1));
  });
  const failure = e.unitOfWork.run(async () => { throw new Error('Falha esperada'); });
  const results = await Promise.allSettled([failure, change(), change()]);
  expect(results.map(r => r.status)).toEqual(['rejected', 'fulfilled', 'fulfilled']);
  expect((await e.repositories.parts.findById(part.id!))?.stockQuantity).toBe(12);
});

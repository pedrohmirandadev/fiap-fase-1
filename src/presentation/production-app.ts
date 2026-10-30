import { sql } from 'drizzle-orm';
import { useCases } from '../production-composition';
import { db } from '../infrastructure/database/connection';
import { createApp } from './app';

export function createProductionApp(jwtSecret?: string) {
  return createApp({
    useCases,
    checkDatabase: async () => { await db.execute(sql`SELECT 1`); },
    ...(jwtSecret === undefined ? {} : { jwtSecret })
  });
}

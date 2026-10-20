import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

export const client = process.env.DATABASE_URL
  ? postgres(process.env.DATABASE_URL, { max: 10 })
  : postgres({ host: 'localhost', database: 'oficina', username: 'oficina', max: 10 });
export const db = drizzle(client, { schema });

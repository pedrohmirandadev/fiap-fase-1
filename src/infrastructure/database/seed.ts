import { client as sql } from './connection';
import { hash } from 'bcryptjs';

const email = process.env.ADMIN_EMAIL ?? 'admin@oficina.local';
const password = process.env.ADMIN_PASSWORD;
try {
  if (!password || password.length < 8) throw new Error('Defina ADMIN_PASSWORD com pelo menos 8 caracteres no ambiente antes do seed');
  await sql`INSERT INTO users (email, password_hash) VALUES (${email}, ${await hash(password, 10)}) ON CONFLICT (email) DO NOTHING`;
  await sql`INSERT INTO customers (name, document, email, phone) VALUES ('Marina Souza', '52998224725', 'marina@example.test', '+5511999990000') ON CONFLICT (document) DO NOTHING`;
  const [customer] = await sql`SELECT id FROM customers WHERE document = '52998224725'`;
  await sql`INSERT INTO vehicles (customer_id, plate, brand, model, year) VALUES (${customer.id}, 'ABC1D23', 'Honda', 'Civic', 2022) ON CONFLICT (plate) DO NOTHING`;
  await sql`INSERT INTO services (name, description, price_cents, estimated_minutes) SELECT 'Troca de óleo', 'Troca de óleo e filtro', 18000, 45 WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Troca de óleo')`;
  await sql`INSERT INTO services (name, description, price_cents, estimated_minutes) SELECT 'Alinhamento', 'Alinhamento de direção', 12000, 60 WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Alinhamento')`;
  await sql`INSERT INTO parts (sku, name, description, price_cents, stock_quantity, minimum_stock) VALUES ('OLEO-5W30', 'Óleo 5W30 (litro)', 'Óleo sintético', 5500, 30, 5) ON CONFLICT (sku) DO NOTHING`;
  await sql`INSERT INTO parts (sku, name, description, price_cents, stock_quantity, minimum_stock) VALUES ('FILTRO-OLEO', 'Filtro de óleo', 'Filtro compatível', 3500, 20, 4) ON CONFLICT (sku) DO NOTHING`;
  console.log(`Seed concluído. Usuário: ${email}`);
} finally { await sql.end(); }

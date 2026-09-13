import * as dotenv from 'dotenv';
dotenv.config();

import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { customers, orders } from './schema';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const customerData = [
  { id: 1, name: 'Alice Khan', email: 'alice@test.com' },
  { id: 2, name: 'Bob Smith', email: 'bob@test.com' },
];

const orderData = [
  // Normal scenarios
  { id: 'ORD-001', customerId: 1, status: 'delivered' as const, amount: '99.99', refunded: false }, // normal refund
  { id: 'ORD-002', customerId: 1, status: 'delivered' as const, amount: '49.99', refunded: true }, // already refunded
  { id: 'ORD-003', customerId: 1, status: 'pending' as const, amount: '29.99', refunded: false }, // cancellable
  { id: 'ORD-004', customerId: 1, status: 'shipped' as const, amount: '79.99', refunded: false }, // cannot cancel
  { id: 'ORD-005', customerId: 2, status: 'delivered' as const, amount: '59.99', refunded: false }, // wrong customer
  { id: 'ORD-006', customerId: 1, status: 'delivered' as const, amount: '149.99', refunded: false }, // concurrent refund test
  { id: 'ORD-007', customerId: 1, status: 'processing' as const, amount: '39.99', refunded: false }, // cancellable
  { id: 'ORD-008', customerId: 1, status: 'delivered' as const, amount: '89.99', refunded: false }, // concurrent approval test
];

async function seed() {
  await db.execute(
    sql`TRUNCATE TABLE escalations, agent_runs, support_requests, refunds, orders, customers RESTART IDENTITY CASCADE`
  );

  await db.insert(customers).values(customerData);
  await db.insert(orders).values(orderData);

  console.log(`Seeded ${customerData.length} customers and ${orderData.length} orders`);
}

seed()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('Seed failed:', err);
    await pool.end();
    process.exit(1);
  });

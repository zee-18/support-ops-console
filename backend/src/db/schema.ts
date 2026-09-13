import {
  boolean,
  decimal,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const orderStatuses = [
  'pending',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
] as const;
export type OrderStatus = (typeof orderStatuses)[number];

export const supportRequestStatuses = [
  'pending',
  'resolved',
  'escalated',
] as const;
export type SupportRequestStatus = (typeof supportRequestStatuses)[number];

export const agentDecisions = ['auto_execute', 'escalate'] as const;
export type AgentDecision = (typeof agentDecisions)[number];

export const proposedActions = ['refund', 'cancel', 'replace'] as const;
export type ProposedAction = (typeof proposedActions)[number];

export const escalationStatuses = ['pending', 'approved', 'rejected'] as const;
export type EscalationStatus = (typeof escalationStatuses)[number];

export type ToolCall = {
  tool: string;
  input: unknown;
  response: unknown;
};

export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
});

export const orders = pgTable('orders', {
  id: text('id').primaryKey(),
  customerId: integer('customer_id').references(() => customers.id),
  status: text('status').$type<OrderStatus>().notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  refunded: boolean('refunded').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const refunds = pgTable('refunds', {
  id: serial('id').primaryKey(),
  orderId: text('order_id')
    .notNull()
    .unique()
    .references(() => orders.id),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const supportRequests = pgTable('support_requests', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id').references(() => customers.id),
  orderId: text('order_id').references(() => orders.id),
  message: text('message').notNull(),
  status: text('status').$type<SupportRequestStatus>().notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const agentRuns = pgTable('agent_runs', {
  id: serial('id').primaryKey(),
  supportRequestId: integer('support_request_id')
    .notNull()
    .references(() => supportRequests.id),
  toolCalls: jsonb('tool_calls').$type<ToolCall[]>().notNull(),
  reasoning: text('reasoning').notNull(),
  decision: text('decision').$type<AgentDecision>().notNull(),
  iterations: integer('iterations').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const escalations = pgTable('escalations', {
  id: serial('id').primaryKey(),
  agentRunId: integer('agent_run_id')
    .notNull()
    .references(() => agentRuns.id),
  supportRequestId: integer('support_request_id')
    .notNull()
    .references(() => supportRequests.id),
  proposedAction: text('proposed_action').$type<ProposedAction>().notNull(),
  proposedAmount: decimal('proposed_amount', { precision: 10, scale: 2 }),
  reasoning: text('reasoning').notNull(),
  status: text('status')
    .$type<EscalationStatus>()
    .notNull()
    .default('pending'),
  reviewedBy: text('reviewed_by'),
  reviewedAt: timestamp('reviewed_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

import { and, desc, eq, inArray } from 'drizzle-orm'
import { runAgent } from '../agent/agentLoop'
import { db } from '../db/index'
import * as schema from '../db/schema'
import {
  ConflictError,
  GuardrailError,
  NotFoundError,
} from '../errors'
import { logger } from '../lib/logger'

export async function getAllSupportRequests() {
  return db
    .select({
      id: schema.supportRequests.id,
      customerId: schema.supportRequests.customerId,
      orderId: schema.supportRequests.orderId,
      message: schema.supportRequests.message,
      status: schema.supportRequests.status,
      createdAt: schema.supportRequests.createdAt,
      customerName: schema.customers.name,
      escalationId: schema.escalations.id,
    })
    .from(schema.supportRequests)
    .leftJoin(
      schema.customers,
      eq(schema.customers.id, schema.supportRequests.customerId),
    )
    .leftJoin(
      schema.escalations,
      eq(schema.escalations.supportRequestId, schema.supportRequests.id),
    )
    .orderBy(desc(schema.supportRequests.createdAt))
}

export async function getSupportRequestById(id: number) {
  const supportRequest = await db.query.supportRequests.findFirst({
    where: eq(schema.supportRequests.id, id),
  })

  if (!supportRequest) {
    throw new NotFoundError('NOT_FOUND', 'Support request not found')
  }

  const [agentRun, escalation, order] = await Promise.all([
    db.query.agentRuns.findFirst({
      where: eq(schema.agentRuns.supportRequestId, supportRequest.id),
    }),
    db.query.escalations.findFirst({
      where: eq(schema.escalations.supportRequestId, supportRequest.id),
    }),
    supportRequest.orderId
      ? db.query.orders.findFirst({
          where: eq(schema.orders.id, supportRequest.orderId),
        })
      : Promise.resolve(null),
  ])

  return {
    support_request: supportRequest,
    agent_run: agentRun ?? null,
    escalation: escalation ?? null,
    order: order
      ? {
          id: order.id,
          status: order.status,
          amount: order.amount,
          refunded: order.refunded,
        }
      : null,
  }
}

export async function createSupportRequest(data: {
  customer_id: number
  order_id: string
  message: string
}) {
  const order = await db.query.orders.findFirst({
    where: eq(schema.orders.id, data.order_id),
  })

  if (!order) {
    throw new NotFoundError(
      'ORDER_NOT_FOUND',
      `Order ${data.order_id} not found`,
    )
  }

  if (order.status === 'cancelled') {
    throw new GuardrailError(
      'ORDER_ALREADY_CANCELLED',
      `Order ${data.order_id} is already cancelled`,
    )
  }

  const existing = await db.query.supportRequests.findFirst({
    where: and(
      eq(schema.supportRequests.orderId, data.order_id),
      inArray(schema.supportRequests.status, ['pending', 'escalated']),
    ),
  })

  if (existing) {
    throw new ConflictError(
      'DUPLICATE_REQUEST',
      `An open support request already exists for order ${data.order_id}`,
    )
  }

  const [createdSupportRequest] = await db
    .insert(schema.supportRequests)
    .values({
      customerId: data.customer_id,
      orderId: data.order_id,
      message: data.message,
      status: 'pending',
    })
    .returning()

  const agentResult = await runAgent({
    id: createdSupportRequest.id,
    customer_id: createdSupportRequest.customerId,
    order_id: createdSupportRequest.orderId,
    message: createdSupportRequest.message,
  })

  const nextStatus =
    agentResult.decision === 'auto_execute' ? 'resolved' : 'escalated'

  await db
    .update(schema.supportRequests)
    .set({ status: nextStatus })
    .where(eq(schema.supportRequests.id, createdSupportRequest.id))

  const updatedSupportRequest = await db.query.supportRequests.findFirst({
    where: eq(schema.supportRequests.id, createdSupportRequest.id),
  })

  logger.info('support_request_created', {
    supportRequestId: createdSupportRequest.id,
    agentDecision: agentResult.decision,
    agentRunId: agentResult.agentRunId,
  })

  return {
    support_request: updatedSupportRequest,
    agent_decision: agentResult.decision,
    agent_run_id: agentResult.agentRunId,
  }
}

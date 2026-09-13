import { desc, eq } from 'drizzle-orm'
import { db } from '../db/index'
import * as schema from '../db/schema'
import { NotFoundError } from '../errors'
import { approveEscalation } from '../guardrails/approveEscalation'
import { rejectEscalation } from '../guardrails/rejectEscalation'
import { logger } from '../lib/logger'

export async function getAllEscalations() {
  return db
    .select({
      id: schema.escalations.id,
      agentRunId: schema.escalations.agentRunId,
      supportRequestId: schema.escalations.supportRequestId,
      proposedAction: schema.escalations.proposedAction,
      proposedAmount: schema.escalations.proposedAmount,
      reasoning: schema.escalations.reasoning,
      status: schema.escalations.status,
      reviewedBy: schema.escalations.reviewedBy,
      reviewedAt: schema.escalations.reviewedAt,
      createdAt: schema.escalations.createdAt,
      supportRequestMessage: schema.supportRequests.message,
      orderId: schema.supportRequests.orderId,
      orderStatus: schema.orders.status,
      orderAmount: schema.orders.amount,
      orderRefunded: schema.orders.refunded,
    })
    .from(schema.escalations)
    .leftJoin(
      schema.supportRequests,
      eq(schema.supportRequests.id, schema.escalations.supportRequestId),
    )
    .leftJoin(
      schema.orders,
      eq(schema.orders.id, schema.supportRequests.orderId),
    )
    .orderBy(desc(schema.escalations.createdAt))
}

export async function getEscalationById(id: number) {
  const escalation = await db.query.escalations.findFirst({
    where: eq(schema.escalations.id, id),
  })

  if (!escalation) {
    throw new NotFoundError('NOT_FOUND', 'Escalation not found')
  }

  const supportRequest = await db.query.supportRequests.findFirst({
    where: eq(schema.supportRequests.id, escalation.supportRequestId),
  })

  const [order, agentRun] = await Promise.all([
    supportRequest?.orderId
      ? db.query.orders.findFirst({
          where: eq(schema.orders.id, supportRequest.orderId),
        })
      : Promise.resolve(null),
    db.query.agentRuns.findFirst({
      where: eq(schema.agentRuns.id, escalation.agentRunId),
    }),
  ])

  return {
    escalation,
    support_request: supportRequest
      ? {
          id: supportRequest.id,
          customerId: supportRequest.customerId,
          orderId: supportRequest.orderId,
          message: supportRequest.message,
          status: supportRequest.status,
          createdAt: supportRequest.createdAt,
        }
      : null,
    order: order
      ? {
          id: order.id,
          status: order.status,
          amount: order.amount,
          refunded: order.refunded,
        }
      : null,
    agent_run: agentRun
      ? {
          id: agentRun.id,
          reasoning: agentRun.reasoning,
          tool_calls: agentRun.toolCalls,
          iterations: agentRun.iterations,
        }
      : null,
  }
}

export async function approveEscalationById(id: number, reviewerName: string) {
  const result = await approveEscalation(id, reviewerName)

  logger.info('escalation_approve_route', {
    escalationId: id,
    reviewedBy: reviewerName,
  })

  return result
}

export async function rejectEscalationById(id: number, reviewerName: string) {
  const result = await rejectEscalation(id, reviewerName)

  logger.info('escalation_reject_route', {
    escalationId: id,
    reviewedBy: reviewerName,
  })

  return result
}

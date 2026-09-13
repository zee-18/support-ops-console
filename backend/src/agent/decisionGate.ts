import { eq } from 'drizzle-orm'
import { db } from '../db/index'
import { escalations, orders, supportRequests } from '../db/schema'
import type { AgentDecision, ProposedAction } from '../db/schema'
import { executeCancellation, executeRefund } from '../guardrails/index'
import { GuardrailError } from '../errors'
import { logger } from '../lib/logger'

export type DecisionInput = {
  action: string
  order_id?: string
  reasoning: string
}

export type HandleAgentDecisionResult = {
  decision: AgentDecision
  escalationId?: number
  reason?: string
}

function toProposedAction(action: string): ProposedAction {
  if (action === 'refund' || action === 'cancel' || action === 'replace') {
    return action
  }
  return 'refund'
}

async function resolveOrderId(
  decision: DecisionInput,
  supportRequestId: number
): Promise<string | undefined> {
  if (decision.order_id) {
    return decision.order_id
  }

  const supportRequest = await db.query.supportRequests.findFirst({
    where: eq(supportRequests.id, supportRequestId)
  })

  return supportRequest?.orderId ?? undefined
}

async function createEscalationRecord(params: {
  agentRunId: number
  supportRequestId: number
  proposedAction: ProposedAction
  proposedAmount?: number
  reasoning: string
}): Promise<number> {
  const [escalation] = await db
    .insert(escalations)
    .values({
      agentRunId: params.agentRunId,
      supportRequestId: params.supportRequestId,
      proposedAction: params.proposedAction,
      proposedAmount:
        params.proposedAmount != null ? String(params.proposedAmount) : undefined,
      reasoning: params.reasoning,
      status: 'pending'
    })
    .returning({ id: escalations.id })

  return escalation.id
}

export async function handleAgentDecision(
  decision: DecisionInput,
  supportRequestId: number,
  agentRunId: number
): Promise<HandleAgentDecisionResult> {
  if (decision.action === 'cancel') {
    const orderId = await resolveOrderId(decision, supportRequestId)

    if (!orderId) {
      const escalationId = await createEscalationRecord({
        agentRunId,
        supportRequestId,
        proposedAction: 'cancel',
        reasoning: decision.reasoning
      })

      await db
        .update(supportRequests)
        .set({ status: 'escalated' })
        .where(eq(supportRequests.id, supportRequestId))

      logger.info('agent_decision', {
        supportRequestId,
        agentRunId,
        decision: 'escalate',
        action: 'cancel',
        reason: 'missing_order_id'
      })

      return { decision: 'escalate', escalationId }
    }

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId)
    })

    if (!order) {
      const escalationId = await createEscalationRecord({
        agentRunId,
        supportRequestId,
        proposedAction: 'cancel',
        reasoning: decision.reasoning
      })

      await db
        .update(supportRequests)
        .set({ status: 'escalated' })
        .where(eq(supportRequests.id, supportRequestId))

      logger.info('agent_decision', {
        supportRequestId,
        agentRunId,
        decision: 'escalate',
        action: 'cancel',
        reason: 'order_not_found',
        orderId
      })

      return { decision: 'escalate', escalationId }
    }

    if (order.status === 'pending' || order.status === 'processing') {
      const supportRequest = await db.query.supportRequests.findFirst({
        where: eq(supportRequests.id, supportRequestId)
      })
      const customerId = supportRequest?.customerId ?? order.customerId

      if (customerId == null) {
        const escalationId = await createEscalationRecord({
          agentRunId,
          supportRequestId,
          proposedAction: 'cancel',
          reasoning: decision.reasoning
        })

        await db
          .update(supportRequests)
          .set({ status: 'escalated' })
          .where(eq(supportRequests.id, supportRequestId))

        logger.info('agent_decision', {
          supportRequestId,
          agentRunId,
          decision: 'escalate',
          action: 'cancel',
          reason: 'missing_customer_id',
          orderId
        })

        return { decision: 'escalate', escalationId }
      }

      try {
        await executeCancellation(orderId, customerId)
      } catch (error) {
        if (error instanceof GuardrailError) {
          logger.info('guardrail_error', {
            supportRequestId,
            agentRunId,
            action: 'cancel',
            orderId,
            code: error.code,
            message: error.message
          })

          logger.info('already_cancelled_resolved', { orderId, error }) 
          if (error.code === 'ALREADY_CANCELLED') {
            await db
              .update(supportRequests)
              .set({ status: 'resolved' })
              .where(eq(supportRequests.id, supportRequestId))

            return { decision: 'auto_execute', reason: error.message }
          }

          const escalationId = await createEscalationRecord({
            agentRunId,
            supportRequestId,
            proposedAction: 'cancel',
            reasoning: decision.reasoning
          })

          await db
            .update(supportRequests)
            .set({ status: 'escalated' })
            .where(eq(supportRequests.id, supportRequestId))

          logger.info('agent_decision', {
            supportRequestId,
            agentRunId,
            decision: 'escalate',
            action: 'cancel',
            reason: 'guardrail_failed',
            guardrailCode: error.code,
            orderId
          })

          return { decision: 'escalate', escalationId }
        }

        throw error
      }

      await db
        .update(supportRequests)
        .set({ status: 'resolved' })
        .where(eq(supportRequests.id, supportRequestId))

      logger.info('agent_decision', {
        supportRequestId,
        agentRunId,
        decision: 'auto_execute',
        action: 'cancel',
        orderId
      })

      return { decision: 'auto_execute' }
    }

    const escalationId = await createEscalationRecord({
      agentRunId,
      supportRequestId,
      proposedAction: 'cancel',
      reasoning: decision.reasoning
    })

    await db
      .update(supportRequests)
      .set({ status: 'escalated' })
      .where(eq(supportRequests.id, supportRequestId))

    logger.info('agent_decision', {
      supportRequestId,
      agentRunId,
      decision: 'escalate',
      action: 'cancel',
      reason: 'order_not_cancellable',
      orderId,
      orderStatus: order.status
    })

    return { decision: 'escalate', escalationId }
  }

  const orderId = await resolveOrderId(decision, supportRequestId)

  let proposedAmount: number | undefined
  if (orderId) {
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId)
    })
    if (order) {
      proposedAmount = Number(order.amount)
    }
  }

  const escalationId = await createEscalationRecord({
    agentRunId,
    supportRequestId,
    proposedAction: toProposedAction(decision.action),
    proposedAmount,
    reasoning: decision.reasoning
  })

  await db
    .update(supportRequests)
    .set({ status: 'escalated' })
    .where(eq(supportRequests.id, supportRequestId))

  logger.info('agent_decision', {
    supportRequestId,
    agentRunId,
    decision: 'escalate',
    action: decision.action
  })

  return { decision: 'escalate', escalationId }
}

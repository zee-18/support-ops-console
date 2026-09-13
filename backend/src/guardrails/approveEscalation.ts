import { and, eq } from 'drizzle-orm'
import { db } from '../db/index'
import { escalations, supportRequests } from '../db/schema'
import { ConflictError, GuardrailError } from '../errors'
import { logger } from '../lib/logger'
import { executeCancellation, executeRefund } from './index'

export async function approveEscalation(
  escalationId: number,
  reviewerName: string
) {
  const escalation = await db.query.escalations.findFirst({
    where: eq(escalations.id, escalationId),
  })

  if (!escalation || escalation.status !== 'pending') {
    throw new ConflictError(
      'ALREADY_PROCESSED',
      'This escalation has already been reviewed',
    )
  }

  const supportRequest = await db.query.supportRequests.findFirst({
    where: eq(supportRequests.id, escalation.supportRequestId),
  })

  if (!supportRequest?.orderId || supportRequest.customerId == null) {
    throw new GuardrailError(
      'ORDER_NOT_FOUND',
      'Support request is missing order or customer information',
    )
  }

  const { orderId, customerId } = supportRequest

  if (escalation.proposedAction === 'refund') {
    if (escalation.proposedAmount == null) {
      throw new GuardrailError(
        'AMOUNT_EXCEEDED',
        'Escalation is missing a proposed refund amount',
      )
    }

    await executeRefund(
      orderId,
      Number(escalation.proposedAmount),
      customerId,
    )
  } else if (escalation.proposedAction === 'cancel') {
    await executeCancellation(orderId, customerId)
  }

  const [approved] = await db
    .update(escalations)
    .set({
      status: 'approved',
      reviewedBy: reviewerName,
      reviewedAt: new Date(),
    })
    .where(
      and(
        eq(escalations.id, escalationId),
        eq(escalations.status, 'pending'),
      ),
    )
    .returning()

  if (!approved) {
    throw new ConflictError(
      'ALREADY_PROCESSED',
      'This escalation has already been reviewed',
    )
  }

  await db
    .update(supportRequests)
    .set({ status: 'resolved' })
    .where(eq(supportRequests.id, escalation.supportRequestId))

  logger.info('escalation_approved', {
    escalationId,
    reviewedBy: reviewerName,
  })

  return approved
}

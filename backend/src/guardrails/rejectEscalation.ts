import { and, eq } from 'drizzle-orm'
import { db } from '../db/index'
import { escalations, supportRequests } from '../db/schema'
import { ConflictError } from '../errors'
import { logger } from '../lib/logger'

export async function rejectEscalation(
  escalationId: number,
  reviewerName: string
) {
  const result = await db
    .update(escalations)
    .set({
      status: 'rejected',
      reviewedBy: reviewerName,
      reviewedAt: new Date()
    })
    .where(
      and(
        eq(escalations.id, escalationId),
        eq(escalations.status, 'pending')
      )
    )
    .returning()

  if (result.length === 0) {
    throw new ConflictError(
      'ALREADY_PROCESSED',
      'This escalation has already been reviewed'
    )
  }

  const escalation = result[0]

  await db
    .update(supportRequests)
    .set({ status: 'resolved' })
    .where(eq(supportRequests.id, escalation.supportRequestId))

  logger.info('escalation_rejected', {
    escalationId,
    reviewedBy: reviewerName
  })

  return escalation
}

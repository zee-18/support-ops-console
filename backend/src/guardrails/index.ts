import { eq } from 'drizzle-orm'
import { db } from '../db/index'
import { orders, refunds } from '../db/schema'
import { GuardrailError, ConflictError } from '../errors'
import { logger } from '../lib/logger'

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'cause' in error &&
    typeof (error as any).cause === 'object' &&
    (error as any).cause?.code === '23505'
  )
}

export async function executeRefund(
  orderId: string,
  amount: number,
  customerId: number
): Promise<{ success: true; orderId: string; amount: number }> {
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId)
  })

  if (!order) {
    throw new GuardrailError('ORDER_NOT_FOUND', `Order ${orderId} not found`)
  }

  if (order.customerId !== customerId) {
    throw new GuardrailError(
      'WRONG_CUSTOMER',
      `Order ${orderId} does not belong to customer ${customerId}`
    )
  }

  if (order.refunded === true) {
    throw new GuardrailError(
      'ALREADY_REFUNDED',
      `Order ${orderId} has already been refunded`
    )
  }

  if (amount > Number(order.amount)) {
    throw new GuardrailError(
      'AMOUNT_EXCEEDED',
      `Refund amount ${amount} exceeds order amount ${order.amount}`
    )
  }

  try {
    await db.insert(refunds).values({
      orderId,
      amount: String(amount)
    })
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new GuardrailError(
        'DUPLICATE_REFUND',
        `Refund already exists for order ${orderId}`
      )
    }
    throw error
  }

  await db
    .update(orders)
    .set({ refunded: true })
    .where(eq(orders.id, orderId))

  logger.info('refund_executed', { orderId, amount, customerId })

  return { success: true, orderId, amount }
}

export async function executeCancellation(
  orderId: string,
  customerId: number
): Promise<{ success: true; orderId: string }> {
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId)
  })

  if (!order) {
    throw new GuardrailError('ORDER_NOT_FOUND', `Order ${orderId} not found`)
  }

  if (order.customerId !== customerId) {
    throw new GuardrailError(
      'WRONG_CUSTOMER',
      `Order ${orderId} does not belong to customer ${customerId}`
    )
  }

  if (order.status === 'shipped' || order.status === 'delivered') {
    throw new GuardrailError(
      'ALREADY_SHIPPED',
      `Order ${orderId} has already been shipped`
    )
  }

  if (order.status === 'cancelled') {
    logger.info('inside already cancelled guardrail', { orderId, customerId }) 
    throw new GuardrailError(
      'ALREADY_CANCELLED',
      `Order ${orderId} has already been cancelled`
    )
  }

  await db
    .update(orders)
    .set({ status: 'cancelled' })
    .where(eq(orders.id, orderId))

  logger.info('cancellation_executed', { orderId, customerId })

  return { success: true, orderId }
}

import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/index'
import { customers, orders, proposedActions } from '../db/schema'
import { logger } from '../lib/logger'

const orderIdSchema = z.string().min(1)
const customerIdSchema = z.number().int().positive()

const createEscalationSchema = z.object({
  order_id: z.string().min(1),
  proposed_action: z.enum(proposedActions),
  proposed_amount: z.number().optional(),
  reasoning: z.string().min(1)
})

export type CreateEscalationInput = z.infer<typeof createEscalationSchema>

type NotFoundError = { error: 'NOT_FOUND'; message: string }
type ValidationError = { error: 'VALIDATION_ERROR'; message: string }

function validationError(error: z.ZodError): ValidationError {
  return {
    error: 'VALIDATION_ERROR',
    message: error.issues.map((issue) => issue.message).join('; ')
  }
}

function logToolCall(tool: string, input: unknown, result: unknown) {
  logger.info('agent_tool_call', { tool, input, result })
}

function formatOrder(order: typeof orders.$inferSelect) {
  return {
    order_id: order.id,
    customer_id: order.customerId,
    status: order.status,
    amount: order.amount,
    refunded: order.refunded,
    created_at: order.createdAt
  }
}

function formatCustomer(customer: typeof customers.$inferSelect) {
  return {
    customer_id: customer.id,
    name: customer.name,
    email: customer.email
  }
}

export async function get_order(orderId: string) {
  const parsed = orderIdSchema.safeParse(orderId)
  if (!parsed.success) {
    const result = validationError(parsed.error)
    logToolCall('get_order', orderId, result)
    return result
  }

  const order = await db.query.orders.findFirst({
    where: eq(orders.id, parsed.data)
  })

  if (!order) {
    const result: NotFoundError = {
      error: 'NOT_FOUND',
      message: `Order ${parsed.data} not found`
    }
    logToolCall('get_order', orderId, result)
    return result
  }

  const result = formatOrder(order)
  logToolCall('get_order', orderId, result)
  return result
}

export async function get_customer(customerId: number) {
  const parsed = customerIdSchema.safeParse(customerId)
  if (!parsed.success) {
    const result = validationError(parsed.error)
    logToolCall('get_customer', customerId, result)
    return result
  }

  const customer = await db.query.customers.findFirst({
    where: eq(customers.id, parsed.data)
  })

  if (!customer) {
    const result: NotFoundError = {
      error: 'NOT_FOUND',
      message: `Customer ${parsed.data} not found`
    }
    logToolCall('get_customer', customerId, result)
    return result
  }

  const result = formatCustomer(customer)
  logToolCall('get_customer', customerId, result)
  return result
}

export async function cancel_order(orderId: string) {
  const parsed = orderIdSchema.safeParse(orderId)
  if (!parsed.success) {
    const result = validationError(parsed.error)
    logToolCall('cancel_order', orderId, result)
    return result
  }

  const order = await db.query.orders.findFirst({
    where: eq(orders.id, parsed.data)
  })

  if (!order) {
    const result: NotFoundError = {
      error: 'NOT_FOUND',
      message: `Order ${parsed.data} not found`
    }
    logToolCall('cancel_order', orderId, result)
    return result
  }

  const result = {
    order_id: order.id,
    status: order.status,
    refunded: order.refunded,
    customer_id: order.customerId,
    amount: order.amount
  }
  logToolCall('cancel_order', orderId, result)
  return result
}

export async function create_escalation(input: CreateEscalationInput) {
  const parsed = createEscalationSchema.safeParse(input)
  if (!parsed.success) {
    const result = validationError(parsed.error)
    logToolCall('create_escalation', input, result)
    return result
  }

  const result = {
    escalation_requested: true as const,
    ...parsed.data
  }
  logToolCall('create_escalation', input, result)
  return result
}

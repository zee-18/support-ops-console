import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { eq } from 'drizzle-orm'
import { db } from '../db/index'
import { agentRuns } from '../db/schema'
import type { ToolCall } from '../db/schema'
import { openai } from '../lib/openai'
import { logger } from '../lib/logger'
import {
  handleAgentDecision,
  type DecisionInput
} from './decisionGate'
import { systemPrompt } from './systemPrompt'
import {
  cancel_order,
  create_escalation,
  get_customer,
  get_order,
  type CreateEscalationInput
} from './toolExecutor'
import { tools } from './tools'

const MAX_ITERATIONS = 10
const MODEL = 'gpt-4o-mini'

export type SupportRequestContext = {
  id: number
  customer_id: number | null
  order_id: string | null
  message: string
}

async function executeTool(name: string, args: unknown): Promise<unknown> {
  switch (name) {
    case 'get_order':
      return get_order((args as { order_id: string }).order_id)
    case 'get_customer':
      return get_customer((args as { customer_id: number }).customer_id)
    case 'cancel_order':
      return cancel_order((args as { order_id: string }).order_id)
    case 'create_escalation':
      return create_escalation(args as CreateEscalationInput)
    default:
      return { error: 'UNKNOWN_TOOL', message: `Unknown tool: ${name}` }
  }
}

function buildUserMessage(supportRequest: SupportRequestContext): string {
  const lines = [`Support request #${supportRequest.id}`, `Message: ${supportRequest.message}`]

  if (supportRequest.order_id) {
    lines.push(`Order ID: ${supportRequest.order_id}`)
  }

  if (supportRequest.customer_id != null) {
    lines.push(`Customer ID: ${supportRequest.customer_id}`)
  }

  return lines.join('\n')
}

function parseDecision(
  toolCalls: ToolCall[],
  reasoning: string,
  supportRequest: SupportRequestContext,
  fallback?: { action: string; reason?: string }
): DecisionInput {
  const escalationCall = [...toolCalls]
    .reverse()
    .find((tc) => tc.tool === 'create_escalation')

  if (escalationCall && typeof escalationCall.input === 'object' && escalationCall.input) {
    const input = escalationCall.input as CreateEscalationInput
    return {
      action: input.proposed_action,
      order_id: input.order_id ?? supportRequest.order_id ?? undefined,
      reasoning: input.reasoning || reasoning,
    }
  }

  const cancelCall = [...toolCalls].reverse().find((tc) => tc.tool === 'cancel_order')

  if (cancelCall && typeof cancelCall.input === 'object' && cancelCall.input) {
    const input = cancelCall.input as { order_id?: string }
    return {
      action: 'cancel',
      order_id: input.order_id ?? supportRequest.order_id ?? undefined,
      reasoning
    }
  }

  if (fallback) {
    return {
      action: fallback.action,
      order_id: supportRequest.order_id ?? undefined,
      reasoning: fallback.reason ? `${reasoning} (${fallback.reason})` : reasoning
    }
  }

  return {
    action: 'refund',
    order_id: supportRequest.order_id ?? undefined,
    reasoning
  }
}

export async function runAgent(
  supportRequest: SupportRequestContext
): Promise<{ decision: string; agentRunId: number }> {
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: buildUserMessage(supportRequest) }
  ]

  const recordedToolCalls: ToolCall[] = []
  let iterations = 0
  let reasoning = ''
  let decisionInput: DecisionInput | null = null

  while (iterations < MAX_ITERATIONS) {
    iterations++

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages,
      tools
    })

    const choice = response.choices[0]
    const assistantMessage = choice.message
    const finishReason = choice.finish_reason

    if (finishReason === 'tool_calls' && assistantMessage.tool_calls?.length) {
      messages.push(assistantMessage)

      for (const toolCall of assistantMessage.tool_calls) {
        if (toolCall.type !== 'function') {
          continue
        }

        let args: unknown
        try {
          args = JSON.parse(toolCall.function.arguments)
        } catch {
          args = {}
        }

        const result = await executeTool(toolCall.function.name, args)

        recordedToolCalls.push({
          tool: toolCall.function.name,
          input: args,
          response: result
        })

        logger.info('agent_tool_call', {
          tool: toolCall.function.name,
          input: args,
          result
        })

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        })
      }

      continue
    }

    if (finishReason === 'stop') {
      reasoning = assistantMessage.content ?? ''
      decisionInput = parseDecision(recordedToolCalls, reasoning, supportRequest)
      break
    }

    reasoning = assistantMessage.content ?? `Unexpected finish_reason: ${finishReason}`
    decisionInput = parseDecision(recordedToolCalls, reasoning, supportRequest, {
      action: 'refund',
      reason: `unexpected_finish_reason:${finishReason}`
    })
    break
  }

  if (!decisionInput) {
    reasoning = 'Agent exceeded maximum iterations without completing.'
    decisionInput = parseDecision(recordedToolCalls, reasoning, supportRequest, {
      action: 'refund',
      reason: 'max_iterations_exceeded'
    })
  }

  const tentativeDecision =
    decisionInput.action === 'cancel' ? 'auto_execute' : 'escalate'

  const [agentRun] = await db
    .insert(agentRuns)
    .values({
      supportRequestId: supportRequest.id,
      toolCalls: recordedToolCalls,
      reasoning,
      decision: tentativeDecision,
      iterations
    })
    .returning({ id: agentRuns.id })

  const decisionResult = await handleAgentDecision(
    decisionInput,
    supportRequest.id,
    agentRun.id
  )

  if (decisionResult.decision !== tentativeDecision) {
    await db
      .update(agentRuns)
      .set({ decision: decisionResult.decision })
      .where(eq(agentRuns.id, agentRun.id))
  }

  logger.info('agent_run_persisted', {
    supportRequestId: supportRequest.id,
    agentRunId: agentRun.id,
    decision: decisionResult.decision,
    escalationId: decisionResult.escalationId,
    iterations
  })

  return {
    decision: decisionResult.decision,
    agentRunId: agentRun.id
  }
}

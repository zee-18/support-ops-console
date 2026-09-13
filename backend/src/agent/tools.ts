import type { ChatCompletionTool } from 'openai/resources/chat/completions'

export const tools: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_order',
      description: 'Fetch order details by order ID.',
      parameters: {
        type: 'object',
        properties: {
          order_id: {
            type: 'string',
            description: 'The order ID (e.g. ORD-001).'
          }
        },
        required: ['order_id'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_customer',
      description: 'Fetch customer details by customer ID.',
      parameters: {
        type: 'object',
        properties: {
          customer_id: {
            type: 'number',
            description: 'The customer ID.'
          }
        },
        required: ['customer_id'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'cancel_order',
      description: 'Cancel an order. Only valid for pending or processing orders.',
      parameters: {
        type: 'object',
        properties: {
          order_id: {
            type: 'string',
            description: 'The order ID to cancel.'
          }
        },
        required: ['order_id'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_escalation',
      description:
        'Escalate a support request to a human reviewer for refunds, replacements, or ambiguous cases.',
      parameters: {
        type: 'object',
        properties: {
          order_id: {
            type: 'string',
            description: 'The order ID related to the escalation.'
          },
          proposed_action: {
            type: 'string',
            enum: ['refund', 'cancel', 'replace'],
            description: 'The action proposed for human review.'
          },
          proposed_amount: {
            type: 'number',
            description: 'The proposed refund or replacement amount, if applicable.'
          },
          reasoning: {
            type: 'string',
            description: 'Explanation of why this request is being escalated.'
          }
        },
        required: ['order_id', 'proposed_action', 'reasoning'],
        additionalProperties: false
      }
    }
  }
]

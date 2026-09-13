export interface SupportRequest {
  id: number
  customer_id: number
  order_id: string
  message: string
  status: 'pending' | 'resolved' | 'escalated'
  created_at: string
  customer_name?: string
}

export interface Order {
  id: string
  customer_id: number
  status: string
  amount: string
  refunded: boolean
}

export interface ToolCall {
  tool: string
  input: unknown
  result: unknown
}

export interface AgentRun {
  id: number
  tool_calls: ToolCall[]
  reasoning: string
  decision: string
  iterations: number
}

export interface Escalation {
  id: number
  agent_run_id: number
  support_request_id: number
  proposed_action: 'refund' | 'cancel' | 'replace'
  proposed_amount: number | null
  reasoning: string
  status: 'pending' | 'approved' | 'rejected'
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  support_request?: SupportRequest
  order?: Order
  agent_run?: AgentRun
}

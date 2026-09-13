// src/test-agent.ts
import { db } from './db/index'
import { supportRequests } from './db/schema'
import { runAgent, SupportRequestContext } from './agent/agentLoop'
import { executeRefund } from './guardrails/index'
import { executeCancellation } from './guardrails/index'

async function main() {
  // Insert support request first
//   const [supportRequest] = await db.insert(supportRequests).values({
//     customerId: 1,
//     orderId: 'ORD-001',
//     message: 'I want a refund for my order ORD-001',
//     status: 'pending'
//   }).returning()

//   console.log('Support request created:', supportRequest.id)

//   const context: SupportRequestContext = {
//     id: supportRequest.id,
//     customer_id: supportRequest.customerId,
//     order_id: supportRequest.orderId,
//     message: supportRequest.message
//   }
//   const result = await runAgent(context)
//   console.log('Agent result:', result)

  // ORD-002 is already refunded in seed data
// await executeRefund('ORD-002', 49.99, 1)
// Expected: throws GuardrailError ALREADY_REFUNDED


// ORD-005 belongs to customer_id 2
// await executeRefund('ORD-005', 59.99, 1)
// Expected: throws GuardrailError WRONG_CUSTOMER


// ORD-004 is shipped
// await executeCancellation('ORD-004', 1)
// Expected: throws GuardrailError ALREADY_SHIPPED

// ORD-003 is pending
// await executeCancellation('ORD-003', 1)
// Expected: { success: true, orderId: 'ORD-003' }
// Verify in DB: orders where id = ORD-003 → status = 'cancelled'


// Run two refunds simultaneously on ORD-006
await Promise.all([
    executeRefund('ORD-006', 149.99, 1),
    executeRefund('ORD-006', 149.99, 1)
  ])
  // Expected: one succeeds, one throws (UNIQUE constraint or ALREADY_REFUNDED)
}

main().catch(console.error).finally(() => process.exit())

# Architecture — Support Operations Console

## Overview

A full-stack support operations console for an e-commerce store. An AI agent processes incoming customer support requests and either executes actions autonomously or escalates them to a human reviewer. The human reviewer is the center of the product — the UI is designed to make safe decisions fast, not to minimize human involvement.

---

## Agent Boundary

### What the agent may execute autonomously

- Cancel orders with status `pending` or `processing`

### What the agent must always escalate

- Refund requests (any amount)
- Replacement requests
- Cancellations where order status is `shipped` or `delivered`
- Requests where intent is ambiguous
- Any run that exceeds `MAX_ITERATIONS = 10`

### How this boundary is enforced in code

The boundary is a code gate, not a prompt instruction. Every LLM decision passes through `handleAgentDecision()` in `src/agent/decisionGate.ts` before anything executes. The function inspects `decision.action` and routes accordingly — the LLM has no path to execute a refund directly regardless of what it decides.

```
LLM decision → handleAgentDecision() → auto-execute OR create escalation record
```

Prompt instructions alone are not sufficient. A jailbreak, a model update, or an ambiguous customer message could cause the LLM to output an unexpected action. `handleAgentDecision()` ensures that even if the LLM returns `action: "refund"`, no refund executes without a human approving it first.

---

## Tool Design

### Tools exposed to the agent

| Tool | Description |
|---|---|
| `get_order` | Fetch order details by ID |
| `get_customer` | Fetch customer details by ID |
| `cancel_order` | Signal intent to cancel (does not execute directly) |
| `create_escalation` | Signal intent to escalate to human review |

### Key design decisions

**Tools signal intent, they do not execute.** `cancel_order` does not cancel the order — it returns a structured decision that `handleAgentDecision()` intercepts. This means the LLM cannot bypass guardrails by calling a tool directly.

**Data is exposed minimally.** The agent only receives what it needs — order status, amount, refund status, customer ID. No sensitive fields are exposed unnecessarily.

**Manual tool-calling loop, no framework.** With 4 tools and a single-domain agent, a framework like LangGraph adds abstraction without benefit. Every line of the loop is owned and explainable. `MAX_ITERATIONS = 10` prevents infinite loops — the agent auto-escalates if it cannot resolve within 10 iterations.

---

## Guardrails

Guardrails are enforced in application code, not in prompts. The exact functions:

**`executeRefund()` — 5 guardrails:**
- Order not found
- Wrong customer (customer_id mismatch)
- Already refunded (`order.refunded = true`)
- Amount exceeds order amount
- Concurrent duplicate (UNIQUE constraint on `refunds.order_id`)

**`executeCancellation()` — 3 guardrails:**
- Order not found
- Wrong customer
- Order already shipped or delivered

These functions are called at approval time, not at escalation creation time. This means guardrails fire regardless of how the approval request arrives — UI, API, or direct DB manipulation bypassed.

### Refund amount

The proposed refund amount shown to reviewers is pulled from the `orders` table at escalation creation time, not from the LLM. This eliminates hallucinated amounts entirely. The LLM decides the action — the database owns the numbers.

---

## Concurrency Safety

### Double refund protection

`refunds.order_id` has a UNIQUE constraint at the database level. Two simultaneous approval requests for the same order will race to insert into `refunds` — exactly one succeeds, the other gets a unique constraint violation which is caught and returned as a `DUPLICATE_REFUND` 400 error.

### Double approval protection

`approveEscalation()` uses an atomic `UPDATE WHERE status = 'pending' RETURNING *`. If two reviewers approve simultaneously, one UPDATE returns 0 rows — that path throws a `ConflictError` returned as 409. The second reviewer sees an error and the UI disables the approve/reject buttons on `DUPLICATE_REFUND` or `ALREADY_PROCESSED` responses.

Both protections are at the database level — not timing assumptions, not application locks.

---

## Failure Handling

| Scenario | Handling |
|---|---|
| Hallucinated order ID | Pre-flight check in `POST /api/support-requests` — 404 before agent runs |
| Already refunded order | Guardrail in `executeRefund()` — checks `order.refunded` |
| Wrong customer's order | Guardrail checks `customerId` match in both `executeRefund()` and `executeCancellation()` |
| Agent exceeds max iterations | Auto-escalates, never hangs |
| Ambiguous request | Agent calls `create_escalation` tool, human reviews |

---

## Traceability

Every agent run persists:
- Customer request (`support_requests`)
- Full tool call trace with inputs and outputs (`agent_runs.tool_calls` JSONB)
- Agent reasoning and decision (`agent_runs.reasoning`, `agent_runs.decision`)
- Escalation record with proposed action and amount (`escalations`)
- Reviewer identity and timestamp (`escalations.reviewed_by`, `escalations.reviewed_at`)

A reviewer or auditor can reconstruct exactly what the agent did, what data it saw, and what decision was made — without touching application logs.

---

## Significant Engineering Decisions

### 1. Synchronous agent execution

**Decision:** Agent runs synchronously within the HTTP request.

**Alternatives considered:** BullMQ job queue — requests enqueue immediately, agent runs in background worker.

**Why rejected:** The concurrency requirement is about DB safety, not throughput. A queue serializes requests and prevents the duplicate-refund race condition from being testable. Synchronous execution keeps the race alive so the UNIQUE constraint and atomic UPDATE can be verified to actually work.

**Production recommendation:** BullMQ + Redis for throughput and reliability at scale.

### 2. Code gate over prompt boundary

**Decision:** `handleAgentDecision()` intercepts every LLM decision before execution.

**Alternatives considered:** Prompt-only boundary — instruct the LLM to never refund without escalating.

**Why rejected:** Prompts are not a trust boundary. Model updates, adversarial inputs, or ambiguous messages can cause unexpected outputs. A code gate is deterministic — the LLM literally has no execution path to a refund without human approval.

### 3. Amount sourced from database, not LLM

**Decision:** `proposed_amount` in escalation records is pulled from `orders.amount` at escalation creation time.

**Alternatives considered:** Use `proposed_amount` from LLM decision output.

**Why rejected:** LLMs can hallucinate numbers. A reviewer seeing a hallucinated amount and approving it would execute a wrong refund — the exact failure mode the system is designed to prevent. By pulling from the DB, the reviewer always sees the exact order amount. The LLM decides the action, the database owns the numbers.

---

## Build vs Buy

| Concern | Built | Production Recommendation |
|
| Agent execution | Synchronous in-request | BullMQ + Redis |
| Agent framework | Manual tool-calling loop | LangGraph (complex multi-agent flows) |
| Agent tracing | JSONB in `agent_runs` table | LangSmith |
| Logging | Winston JSON | Datadog |
| Infrastructure | Railway + Vercel | AWS ECS + RDS |
| Rate limiting | express-rate-limit | API Gateway + WAF |

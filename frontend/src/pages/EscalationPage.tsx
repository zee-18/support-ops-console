import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { get, patch, type ApiError } from '../lib/api'

interface ToolCallRow {
  tool: string
  input: unknown
  result?: unknown
  response?: unknown
}

interface EscalationRecord {
  id: number
  agentRunId: number
  supportRequestId: number
  proposedAction: 'refund' | 'cancel' | 'replace'
  proposedAmount: string | null
  reasoning: string
  status: 'pending' | 'approved' | 'rejected'
  reviewedBy: string | null
  reviewedAt: string | null
  createdAt: string
}

interface SupportRequestDetail {
  support_request: {
    id: number
    customerId: number | null
    orderId: string | null
    message: string
    status: string
    createdAt: string
  }
  agent_run: {
    id: number
    reasoning: string
    toolCalls: ToolCallRow[]
    iterations: number
  } | null
  escalation: EscalationRecord | null
  order: {
    id: string
    status: string
    amount: string
    refunded: boolean
  } | null
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString()
}

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

function getToolCallResult(call: ToolCallRow): unknown {
  return call.result ?? call.response
}

function getApiErrorCode(err: unknown): string | null {
  if (err && typeof err === 'object' && 'error' in err) {
    return String((err as ApiError).error)
  }
  return null
}

function isTerminalActionError(err: unknown): boolean {
  const code = getApiErrorCode(err)
  return code === 'DUPLICATE_REFUND' || code === 'ALREADY_PROCESSED'
}

function getErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as ApiError).message)
  }
  return 'Something went wrong'
}

function Card({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-gray-500 uppercase">
        {title}
      </h2>
      {children}
    </section>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-gray-100 py-2 last:border-0">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="text-right text-sm font-medium text-gray-900">{value}</dd>
    </div>
  )
}

function ToolCallTrace({ toolCalls }: { toolCalls: ToolCallRow[] }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  function toggle(index: number) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  if (toolCalls.length === 0) {
    return <p className="text-sm text-gray-500">No tool calls recorded.</p>
  }

  return (
    <div className="divide-y divide-gray-200 rounded-md border border-gray-200">
      {toolCalls.map((call, index) => {
        const isOpen = expanded.has(index)

        return (
          <div key={index}>
            <button
              type="button"
              onClick={() => toggle(index)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50"
            >
              <span className="font-mono text-sm font-medium text-gray-900">
                {call.tool}
              </span>
              <span className="text-xs text-gray-500">
                {isOpen ? 'Collapse' : 'Expand'}
              </span>
            </button>
            {isOpen && (
              <div className="space-y-3 border-t border-gray-200 bg-gray-50 px-4 py-3">
                <div>
                  <p className="mb-1 text-xs font-medium text-gray-500">Input</p>
                  <pre className="overflow-x-auto rounded bg-white p-3 font-mono text-xs text-gray-800">
                    {formatJson(call.input)}
                  </pre>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-gray-500">
                    Result
                  </p>
                  <pre className="overflow-x-auto rounded bg-white p-3 font-mono text-xs text-gray-800">
                    {formatJson(getToolCallResult(call))}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function EscalationPage() {
  const { id } = useParams<{ id: string }>()
  const [detail, setDetail] = useState<SupportRequestDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reviewerName, setReviewerName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [buttonsDisabled, setButtonsDisabled] = useState(false)

  const refetchDetail = useCallback(async (): Promise<SupportRequestDetail> => {
    if (!id) throw new Error('Missing support request id')

    const data = await get<SupportRequestDetail>(`/api/support-requests/${id}`)
    setDetail(data)
    setError(null)
    return data
  }, [id])

  useEffect(() => {
    if (!id) return

    let cancelled = false

    async function fetchDetail() {
      try {
        await refetchDetail()
      } catch (err) {
        if (cancelled) return
        setError(getErrorMessage(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void fetchDetail()

    return () => {
      cancelled = true
    }
  }, [id, refetchDetail])

  async function handleAction(action: 'approve' | 'reject') {
    const escalationId = detail?.escalation?.id
    if (!escalationId || !reviewerName.trim()) return

    setIsSubmitting(true)
    setActionError(null)

    try {
      await patch(`/api/escalations/${escalationId}/${action}`, {
        reviewer_name: reviewerName.trim(),
      })

      await refetchDetail()
    } catch (err) {
      setActionError(getErrorMessage(err))

      if (isTerminalActionError(err)) {
        setButtonsDisabled(true)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div
          className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-gray-900"
          role="status"
          aria-label="Loading"
        />
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Link
          to="/"
          className="mb-6 inline-block text-sm text-gray-600 hover:text-gray-900"
        >
          ← Back to queue
        </Link>
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error ?? 'Support request not found'}
        </div>
      </div>
    )
  }

  const { support_request, agent_run, escalation, order } = detail
  const hasEscalation = escalation != null
  const isPending = hasEscalation && escalation.status === 'pending'
  const isReviewed =
    hasEscalation &&
    (escalation.status === 'approved' || escalation.status === 'rejected')
  const buttonsDisabledForAction = isSubmitting || buttonsDisabled

  return (
    <div className={`min-h-screen bg-gray-50 ${isPending ? 'pb-32' : 'pb-8'}`}>
      <div className="mx-auto max-w-7xl p-6">
        <Link
          to="/"
          className="mb-6 inline-block text-sm text-gray-600 hover:text-gray-900"
        >
          ← Back to queue
        </Link>

        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-gray-900">
            Support Request ID {support_request.id}
          </h1>
          {hasEscalation ? (
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                escalation.status === 'pending'
                  ? 'bg-yellow-100 text-yellow-800'
                  : escalation.status === 'approved'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
              }`}
            >
              {escalation.status}
            </span>
          ) : (
            <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
              {support_request.status}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <Card title="Customer Message">
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-800">
                {support_request.message}
              </p>
            </Card>

            <Card title="Order Details">
              <dl>
                <DetailRow label="ID" value={order?.id ?? support_request.orderId ?? '—'} />
                <DetailRow label="Status" value={order?.status ?? '—'} />
                <DetailRow
                  label="Amount"
                  value={order?.amount != null ? `$${order.amount}` : '—'}
                />
                <DetailRow
                  label="Refunded"
                  value={
                    order ? (order.refunded ? 'Yes' : 'No') : '—'
                  }
                />
              </dl>
            </Card>

            <Card title="Agent Decision">
              {hasEscalation ? (
                <dl>
                  <DetailRow
                    label="Proposed Action"
                    value={escalation.proposedAction}
                  />
                  <DetailRow
                    label="Proposed Amount"
                    value={
                      escalation.proposedAmount != null
                        ? `$${escalation.proposedAmount}`
                        : '—'
                    }
                  />
                </dl>
              ) : (
                <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                  Auto Executed
                </span>
              )}
            </Card>
          </div>

          <div className="space-y-6">
            <Card title="Agent Reasoning">
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-800">
                {agent_run?.reasoning ?? '—'}
              </p>
            </Card>

            <Card title="Tool Call Trace">
              <ToolCallTrace toolCalls={agent_run?.toolCalls ?? []} />
            </Card>

            <Card title="Iterations">
              <p className="text-2xl font-semibold text-gray-900">
                {agent_run?.iterations ?? '—'}
              </p>
            </Card>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white shadow-lg">
          <div className="mx-auto max-w-7xl p-4">
            {!hasEscalation ? (
              <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                This request was automatically resolved by the agent
              </div>
            ) : isReviewed ? (
              <div className="py-1">
                <p className="text-base font-semibold text-gray-900">
                  Reviewed by {escalation.reviewedBy ?? 'Unknown'}
                </p>
                {escalation.reviewedAt && (
                  <p className="mt-1 text-sm text-gray-600">
                    {formatTime(escalation.reviewedAt)}
                  </p>
                )}
              </div>
            ) : isPending ? (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1">
                  <label
                    htmlFor="reviewer-name"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Reviewer name
                  </label>
                  <input
                    id="reviewer-name"
                    type="text"
                    value={reviewerName}
                    onChange={(e) => setReviewerName(e.target.value)}
                    disabled={buttonsDisabledForAction}
                    placeholder="Enter your name"
                    className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-500 focus:ring-1 focus:ring-gray-500 focus:outline-none disabled:bg-gray-100"
                  />
                  {actionError && (
                    <p
                      className={`mt-2 text-sm ${buttonsDisabled ? 'text-amber-700' : 'text-red-600'}`}
                    >
                      {actionError}
                    </p>
                  )}
                </div>

                {!buttonsDisabled && (
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => void handleAction('reject')}
                      disabled={isSubmitting || !reviewerName.trim()}
                      className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleAction('approve')}
                      disabled={isSubmitting || !reviewerName.trim()}
                      className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Approve
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
    </div>
  )
}

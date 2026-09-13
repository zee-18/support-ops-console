import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import NewRequestModal from '../components/NewRequestModal'
import { get, type ApiError } from '../lib/api'

interface SupportRequestRow {
  id: number
  customerId: number | null
  orderId: string | null
  message: string
  status: 'pending' | 'resolved' | 'escalated'
  createdAt: string
  customerName: string | null
  escalationId: number | null
}

const STATUS_STYLES = {
  pending: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-green-100 text-green-800',
  escalated: 'bg-red-100 text-red-800',
} as const

function truncateMessage(message: string, maxLength = 60): string {
  if (message.length <= maxLength) return message
  return `${message.slice(0, maxLength)}…`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString()
}

function getErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as ApiError).message)
  }
  return 'Failed to load support requests'
}

function renderAction(request: SupportRequestRow) {
  const { id, status, escalationId } = request

  if (status === 'escalated' && escalationId != null) {
    return (
      <Link
        to={`/support-requests/${id}`}
        className="inline-flex rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
      >
        Review
      </Link>
    )
  }

  if (status === 'resolved') { // && escalationId != null
    return (
      <Link
        to={`/support-requests/${id}`}
        className="inline-flex rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
      >
        View
      </Link>
    )
  }

  // if (status === 'resolved') {
  //   return <span className="text-sm text-gray-500">Resolved</span>
  // }

  if (status === 'pending') {
    return <span className="text-sm text-yellow-600">Processing...</span>
  }

  return <span className="text-gray-400">—</span>
}

export default function QueuePage() {
  const [requests, setRequests] = useState<SupportRequestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const refreshQueue = useCallback(async () => {
    try {
      const requestRows = await get<SupportRequestRow[]>(
        '/api/support-requests',
      )
      setRequests(requestRows)
      setError(null)
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }, [])

  const fetchQueue = useCallback(async () => {
    const requestRows = await get<SupportRequestRow[]>(
      '/api/support-requests',
    )
    setRequests(requestRows)
    setError(null)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadQueue() {
      try {
        await fetchQueue()
      } catch (err) {
        if (cancelled) return
        setError(getErrorMessage(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadQueue()

    return () => {
      cancelled = true
    }
  }, [fetchQueue])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div
          className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-gray-900"
          role="status"
          aria-label="Loading"
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">Support Queue</h1>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          New Request
        </button>
      </div>

      <NewRequestModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => void refreshQueue()}
      />

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-600">ID</th>
              <th className="px-4 py-3 font-medium text-gray-600">Customer</th>
              <th className="px-4 py-3 font-medium text-gray-600">Order ID</th>
              <th className="px-4 py-3 font-medium text-gray-600">Message</th>
              <th className="px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 font-medium text-gray-600">Time</th>
              <th className="px-4 py-3 font-medium text-gray-600">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {requests.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  No support requests yet.
                </td>
              </tr>
            ) : (
              requests.map((request) => (
                <tr key={request.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-gray-900">
                    {request.id}
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    {request.customerName ?? '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-700">
                    {request.orderId ?? '—'}
                  </td>
                  <td
                    className="max-w-xs px-4 py-3 text-gray-700"
                    title={request.message}
                  >
                    {truncateMessage(request.message)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[request.status]}`}
                    >
                      {request.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                    {formatTime(request.createdAt)}
                  </td>
                  <td className="px-4 py-3">{renderAction(request)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

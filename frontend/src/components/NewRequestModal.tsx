import { useEffect, useState, type FormEvent } from 'react'
import { post, type ApiError } from '../lib/api'

interface NewRequestModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const INITIAL_FORM = {
  customerId: '',
  orderId: '',
  message: '',
}

function getErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as ApiError).message)
  }
  return 'Failed to create support request'
}

export default function NewRequestModal({
  isOpen,
  onClose,
  onSuccess,
}: NewRequestModalProps) {
  const [customerId, setCustomerId] = useState(INITIAL_FORM.customerId)
  const [orderId, setOrderId] = useState(INITIAL_FORM.orderId)
  const [message, setMessage] = useState(INITIAL_FORM.message)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setCustomerId(INITIAL_FORM.customerId)
      setOrderId(INITIAL_FORM.orderId)
      setMessage(INITIAL_FORM.message)
      setValidationError(null)
      setError(null)
      setIsSubmitting(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  function handleClose() {
    onClose()
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    const trimmedOrderId = orderId.trim()
    const trimmedMessage = message.trim()
    const parsedCustomerId = Number(customerId)

    if (!customerId.trim() || !trimmedOrderId || !trimmedMessage) {
      setValidationError('All fields are required')
      return
    }

    if (!Number.isInteger(parsedCustomerId) || parsedCustomerId <= 0) {
      setValidationError('Customer ID must be a valid positive number')
      return
    }

    if (trimmedMessage.length < 10) {
      setValidationError('Message must be at least 10 characters')
      return
    }

    setValidationError(null)
    setError(null)
    setIsSubmitting(true)

    try {
      await post('/api/support-requests', {
        customer_id: parsedCustomerId,
        order_id: trimmedOrderId,
        message: trimmedMessage,
      })

      onSuccess()
      onClose()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close modal"
        onClick={handleClose}
        className="absolute inset-0 bg-black/40"
      />

      <div className="relative w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">New Request</h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="px-5 py-4">
          {(validationError || error) && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {validationError ?? error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label
                htmlFor="customer-id"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Customer ID
              </label>
              <input
                id="customer-id"
                type="number"
                min={1}
                required
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:ring-1 focus:ring-gray-500 focus:outline-none disabled:bg-gray-100"
              />
            </div>

            <div>
              <label
                htmlFor="order-id"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Order ID
              </label>
              <input
                id="order-id"
                type="text"
                required
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                placeholder="ORD-001"
                disabled={isSubmitting}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-500 focus:ring-1 focus:ring-gray-500 focus:outline-none disabled:bg-gray-100"
              />
            </div>

            <div>
              <label
                htmlFor="message"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Message
              </label>
              <textarea
                id="message"
                required
                minLength={10}
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={isSubmitting}
                className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:ring-1 focus:ring-gray-500 focus:outline-none disabled:bg-gray-100"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

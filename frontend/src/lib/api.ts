const BASE_URL = import.meta.env.DEV ? '' : import.meta.env.VITE_API_URL

export interface ApiError {
  error: string
  message: string
}

async function parseError(response: Response): Promise<ApiError> {
  try {
    const body: unknown = await response.json()
    if (
      body !== null &&
      typeof body === 'object' &&
      'error' in body &&
      'message' in body
    ) {
      return {
        error: String((body as ApiError).error),
        message: String((body as ApiError).message),
      }
    }
  } catch {
    // response body was not JSON
  }

  return {
    error: 'UNKNOWN_ERROR',
    message: response.statusText || 'Request failed',
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  if (!response.ok) {
    throw await parseError(response)
  }

  return response.json() as Promise<T>
}

export function get<T>(path: string): Promise<T> {
  return request<T>(path)
}

export function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function patch<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

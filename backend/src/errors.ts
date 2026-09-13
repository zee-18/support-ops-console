export class GuardrailError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'GuardrailError'
    this.code = code
  }
}

export class ConflictError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'ConflictError'
    this.code = code
  }
}

export class NotFoundError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'NotFoundError'
    this.code = code
  }
}

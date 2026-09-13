import type { NextFunction, Request, Response } from 'express'
import { ConflictError, GuardrailError, NotFoundError } from '../errors'
import { logger } from '../lib/logger'

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  void req
  void next

  if (err instanceof GuardrailError) {
    res.status(400).json({ error: err.code, message: err.message })
    return
  }

  if (err instanceof NotFoundError) {
    res.status(404).json({ error: err.code, message: err.message })
    return
  }

  if (err instanceof ConflictError) {
    res.status(409).json({ error: err.code, message: err.message })
    return
  }

  const message = err instanceof Error ? err.message : 'Unknown error'
  logger.error('unhandled_error', { message })
  res
    .status(500)
    .json({ error: 'INTERNAL_ERROR', message: 'Something went wrong' })
}

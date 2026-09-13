import rateLimit from 'express-rate-limit'

export const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: {
    error: 'RATE_LIMITED',
    message: 'Too many requests, try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
})

export const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: {
    error: 'RATE_LIMITED',
    message: 'Too many requests, try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
})

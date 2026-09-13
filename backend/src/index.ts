import express from 'express'
import * as dotenv from 'dotenv'
import { errorHandler } from './middleware/errorHandler'
import { readLimiter, writeLimiter } from './middleware/rateLimiter'
import { escalationsRouter } from './routes/escalations'
import { supportRequestsRouter } from './routes/supportRequests'
import { logger } from './lib/logger'
import cors from 'cors'

dotenv.config()

const app = express()
app.use(express.json())
app.use(cors({
  origin: ['http://localhost:5173', process.env.FRONTEND_URL || ''],
  methods: ['GET', 'POST', 'PATCH'],
}))
app.use('/api/', readLimiter)
app.use('/api/support-requests', writeLimiter)
app.use('/api/escalations/:id/approve', writeLimiter)
app.use('/api/escalations/:id/reject', writeLimiter)
app.use('/api/support-requests', supportRequestsRouter)
app.use('/api/escalations', escalationsRouter)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use(errorHandler)

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  logger.info('server_started', { port: PORT })
})

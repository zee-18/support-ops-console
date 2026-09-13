import { Router } from 'express'
import { z } from 'zod'
import {
  createSupportRequest,
  getAllSupportRequests,
  getSupportRequestById,
} from '../services/supportRequest.service'

const createSupportRequestSchema = z.object({
  customer_id: z.number(),
  order_id: z.string(),
  message: z.string(),
})

export const supportRequestsRouter = Router()

supportRequestsRouter.post('/', async (req, res, next) => {
  try {
    const body = createSupportRequestSchema.parse(req.body)
    const result = await createSupportRequest(body)
    res.status(201).json(result)
  } catch (error) {
    next(error)
  }
})

supportRequestsRouter.get('/', async (_req, res, next) => {
  try {
    const rows = await getAllSupportRequests()
    res.json(rows)
  } catch (error) {
    next(error)
  }
})

supportRequestsRouter.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'INVALID_ID', message: 'Invalid support request id' })
      return
    }

    const result = await getSupportRequestById(id)
    res.json(result)
  } catch (error) {
    next(error)
  }
})

import { Router } from 'express'
import { z } from 'zod'
import { NotFoundError } from '../errors'
import {
  approveEscalationById,
  getAllEscalations,
  getEscalationById,
  rejectEscalationById,
} from '../services/escalation.service'

const reviewerSchema = z.object({
  reviewer_name: z.string(),
})

export const escalationsRouter = Router()

escalationsRouter.get('/', async (_req, res, next) => {
  try {
    const rows = await getAllEscalations()
    res.json(rows)
  } catch (error) {
    next(error)
  }
})

escalationsRouter.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'INVALID_ID', message: 'Invalid escalation id' })
      return
    }

    const result = await getEscalationById(id)
    res.json(result)
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({ error: error.code, message: error.message })
      return
    }
    next(error)
  }
})

escalationsRouter.patch('/:id/approve', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'INVALID_ID', message: 'Invalid escalation id' })
      return
    }

    const body = reviewerSchema.parse(req.body)
    const result = await approveEscalationById(id, body.reviewer_name)
    res.json(result)
  } catch (error) {
    next(error)
  }
})

escalationsRouter.patch('/:id/reject', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'INVALID_ID', message: 'Invalid escalation id' })
      return
    }

    const body = reviewerSchema.parse(req.body)
    const result = await rejectEscalationById(id, body.reviewer_name)
    res.json(result)
  } catch (error) {
    next(error)
  }
})

import { Router } from 'express'
import { createReservation } from '../controllers/reservationController.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = Router()

router.post('/', requireAuth, createReservation)

export default router

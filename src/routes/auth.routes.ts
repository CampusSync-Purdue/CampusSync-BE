import { Router } from 'express'
import { getMe, login, logout } from '../controllers/auth.controller.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = Router()

router.post('/login', login)
router.post('/logout', logout)
router.get('/me', requireAuth, getMe)

export default router

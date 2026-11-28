import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { getMe, login, logout } from '../controllers/auth.controller.js'
import {
  confirmPasswordReset,
  forgotPassword,
} from '../controllers/passwordResetController.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = Router()

/**
 * CSYNC-29 — Password-reset rate limiting.
 *
 * Limits apply per client IP address.
 */

// Maximum 5 forgot-password requests every 15 minutes.
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    message: 'Too many password-reset requests. Please try again later.',
  },
})

// Maximum 10 reset attempts every 15 minutes.
const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    message: 'Too many password-reset attempts. Please try again later.',
  },
})

/**
 * Existing authentication endpoints.
 */
router.post('/login', login)
router.post('/logout', logout)
router.get('/me', requireAuth, getMe)

/**
 * CSYNC-29 — Forgot password endpoints.
 *
 * These endpoints do not require authentication because
 * users need access to them when they cannot sign in.
 */
router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  forgotPassword,
)

router.post(
  '/reset-password',
  resetPasswordLimiter,
  confirmPasswordReset,
)

export default router
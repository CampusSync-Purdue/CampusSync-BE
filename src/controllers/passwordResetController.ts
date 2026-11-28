import type { Request, Response } from 'express'
import {
  InvalidNewPasswordError,
  InvalidResetTokenError,
  requestPasswordReset,
  resetPassword,
} from '../services/passwordResetService.js'
import { EMAIL_MAX_LENGTH } from '../validation/registerValidation.js'

/**
 * CSYNC-29 — Password reset API controller.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/

/**
 * POST /api/auth/forgot-password
 *
 * Returns the same confirmation for valid email addresses,
 * regardless of whether an account exists.
 *
 * Password-reset processing happens asynchronously so SMTP
 * delivery time does not affect the HTTP response time.
 *
 * Note: A durable background job queue should replace this
 * best-effort approach for production deployments.
 */
export async function forgotPassword(
  request: Request,
  response: Response,
): Promise<void> {
  const email: unknown = request.body?.email

  if (
    typeof email !== 'string' ||
    !email.trim() ||
    email.trim().length > EMAIL_MAX_LENGTH ||
    !EMAIL_PATTERN.test(email.trim())
  ) {
    response.status(400).json({
      message: 'Enter a valid email address.',
    })
    return
  }

  /**
   * Start password-reset processing without waiting for
   * database operations or SMTP delivery.
   *
   * Both registered and unregistered email requests
   * receive the same response immediately.
   *
   * Attach a rejection handler to avoid unhandled
   * promise rejections.
   */
  void requestPasswordReset(email).catch(() => {
    // Never log reset tokens, URLs, or SMTP credentials.
    console.error('Password-reset request failed.')
  })

  response.status(200).json({
    message:
      'If an account with that email address exists, you will receive password-reset instructions.',
  })
}

/**
 * POST /api/auth/reset-password
 *
 * Validates password confirmation and delegates
 * the password update to the reset service.
 */
export async function confirmPasswordReset(
  request: Request,
  response: Response,
): Promise<void> {
  const token: unknown = request.body?.token
  const newPassword: unknown = request.body?.newPassword
  const confirmPassword: unknown = request.body?.confirmPassword

  if (
    typeof confirmPassword !== 'string' ||
    confirmPassword !== newPassword
  ) {
    response.status(400).json({
      message: 'The password and confirmation do not match.',
    })
    return
  }

  try {
    await resetPassword(token, newPassword)

    response.status(200).json({
      message:
        'Your password has been reset successfully. Please sign in again.',
    })
  } catch (error) {
    if (error instanceof InvalidNewPasswordError) {
      response.status(400).json({
        message: error.message,
      })
      return
    }

    if (error instanceof InvalidResetTokenError) {
      response.status(400).json({
        message: error.message,
      })
      return
    }

    console.error('Password reset failed.')

    response.status(500).json({
      message:
        'Unable to reset your password right now. Please try again later.',
    })
  }
}
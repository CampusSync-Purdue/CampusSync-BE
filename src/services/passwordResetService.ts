import bcrypt from 'bcrypt'
import { findUserByEmail } from '../repositories/userRepository.js'
import {
  deletePasswordResetToken,
  insertPasswordResetToken,
  isPasswordResetTokenUsable,
  redeemPasswordResetToken,
} from '../repositories/passwordResetRepository.js'
import {
  normalizeEmail,
  validatePassword,
} from '../validation/registerValidation.js'
import { PASSWORD_SALT_ROUNDS } from './userService.js'
import {
  generatePasswordResetToken,
  hashPasswordResetToken,
} from './passwordResetToken.js'
import { sendPasswordResetEmail } from './passwordResetEmail.js'

/**
 * CSYNC-29 — Reset a forgotten password.
 */

export class InvalidResetTokenError extends Error {
  constructor() {
    super('This password-reset link is invalid or has expired.')
    this.name = 'InvalidResetTokenError'
  }
}

export class InvalidNewPasswordError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidNewPasswordError'
  }
}

export type PasswordResetEmailSender = typeof sendPasswordResetEmail

/**
 * Builds the reset link using a trusted, configured URL.
 *
 * Never build password-reset links from request Host headers.
 */
function buildPasswordResetUrl(token: string): string {
  const configuredUrl = process.env.PASSWORD_RESET_URL

  if (!configuredUrl) {
    throw new Error('PASSWORD_RESET_URL is not configured.')
  }

  const url = new URL(configuredUrl)

  const isHttps = url.protocol === 'https:'
  const isLocalDevelopment =
    url.protocol === 'http:' &&
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1')

  if (!isHttps && !isLocalDevelopment) {
    throw new Error('PASSWORD_RESET_URL must use HTTPS.')
  }

  if (url.username || url.password || url.hash) {
    throw new Error('PASSWORD_RESET_URL contains unsupported components.')
  }

  url.searchParams.set('token', token)

  return url.toString()
}

/**
 * Requests a password reset.
 *
 * The API will return the same neutral response whether or not
 * the email address belongs to a registered user.
 *
 * Email delivery can be injected during tests so that tests
 * never send real emails.
 */
export async function requestPasswordReset(
  email: string,
  sendEmail: PasswordResetEmailSender = sendPasswordResetEmail,
): Promise<void> {
  const normalizedEmail = normalizeEmail(email)

  const user = await findUserByEmail(normalizedEmail)

  // Do not reveal whether the email belongs to an account.
  if (!user) {
    return
  }

  const { token, tokenHash, expiresAt } = generatePasswordResetToken()

  let tokenStored = false

  try {
    const resetUrl = buildPasswordResetUrl(token)

    await insertPasswordResetToken(
      user.id,
      tokenHash,
      expiresAt,
    )

    tokenStored = true

    await sendEmail(user.email, resetUrl)
  } catch {
    // If delivery fails, remove the unusable token.
    if (tokenStored) {
      try {
        await deletePasswordResetToken(tokenHash)
      } catch {
        console.error('Password-reset token cleanup failed.')
      }
    }

    // Do not log the token, reset URL, or SMTP credentials.
    console.error('Password-reset request could not be delivered.')
  }
}

/**
 * Resets a user's password using a valid, single-use token.
 *
 * This function:
 * 1. Validates the new password.
 * 2. Validates the token format.
 * 3. Checks token availability before bcrypt hashing.
 * 4. Hashes the new password.
 * 5. Atomically consumes the token and updates the account.
 */
export async function resetPassword(
  token: unknown,
  newPassword: unknown,
): Promise<void> {
  const passwordError = validatePassword(newPassword)

  if (passwordError) {
    throw new InvalidNewPasswordError(passwordError)
  }

  if (
    typeof token !== 'string' ||
    !/^[a-f0-9]{64}$/.test(token)
  ) {
    throw new InvalidResetTokenError()
  }

  const tokenHash = hashPasswordResetToken(token)

  const usable = await isPasswordResetTokenUsable(tokenHash)

  if (!usable) {
    throw new InvalidResetTokenError()
  }

  const newPasswordHash = await bcrypt.hash(
    newPassword as string,
    PASSWORD_SALT_ROUNDS,
  )

  const success = await redeemPasswordResetToken(
    tokenHash,
    newPasswordHash,
  )

  if (!success) {
    throw new InvalidResetTokenError()
  }
}
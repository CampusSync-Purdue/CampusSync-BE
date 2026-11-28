import { createHash, randomBytes } from 'node:crypto'

/**
 * CSYNC-29 — Password reset token configuration.
 *
 * 32 random bytes provide 256 bits of randomness.
 * Tokens expire 30 minutes after creation.
 */
export const PASSWORD_RESET_TOKEN_BYTES = 32
export const PASSWORD_RESET_TOKEN_TTL_MS = 30 * 60 * 1000

/**
 * Hashes a reset token before storing or looking it up.
 *
 * The raw token must never be stored in the database.
 */
export function hashPasswordResetToken(token: string): string {
  return createHash('sha256')
    .update(token)
    .digest('hex')
}

/**
 * Generates a secure password-reset token.
 *
 * token:
 *   Sent only through the password-reset email.
 *
 * tokenHash:
 *   Stored in PostgreSQL.
 *
 * expiresAt:
 *   30 minutes after generation.
 */
export function generatePasswordResetToken(): {
  token: string
  tokenHash: string
  expiresAt: Date
} {
  const token = randomBytes(PASSWORD_RESET_TOKEN_BYTES).toString('hex')

  return {
    token,
    tokenHash: hashPasswordResetToken(token),
    expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
  }
}
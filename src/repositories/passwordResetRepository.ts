import { and, eq, gt, isNull, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { passwordResetTokens, users } from '../db/schema.js'

/**
 * CSYNC-29 — Password reset repository.
 *
 * Manages reset tokens and password updates in PostgreSQL.
 */

/**
 * Stores a password-reset token hash.
 *
 * Never store the raw token.
 */
export async function insertPasswordResetToken(
  userId: string,
  tokenHash: string,
  expiresAt: Date,
): Promise<void> {
  await db.insert(passwordResetTokens).values({
    userId,
    tokenHash,
    expiresAt,
  })
}

/**
 * Removes a reset token by its hash.
 *
 * Used when sending the reset email fails.
 */
export async function deletePasswordResetToken(
  tokenHash: string,
): Promise<void> {
  await db
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.tokenHash, tokenHash))
}

/**
 * Redeems a password-reset token.
 *
 * A valid token must:
 * - Exist in the database.
 * - Not have been used.
 * - Not have expired.
 *
 * On successful redemption:
 * - Updates the user's password.
 * - Marks the token as used.
 * - Invalidates other unused reset tokens.
 * - Increments sessionVersion to invalidate previous JWTs.
 *
 * The entire operation is atomic.
 *
 * Returns false for invalid, expired, or previously used tokens.
 */
export async function redeemPasswordResetToken(
  tokenHash: string,
  newPasswordHash: string,
): Promise<boolean> {
  return db.transaction(async (transaction) => {
    /**
     * Step 1: Find the account associated with the token.
     *
     * This lookup does not lock or consume the token.
     */
    const [tokenOwner] = await transaction
      .select({
        userId: passwordResetTokens.userId,
      })
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, tokenHash))
      .limit(1)

    if (!tokenOwner) {
      return false
    }

    /**
     * Step 2: Lock the user's row before modifying any tokens.
     *
     * Concurrent reset requests for the same account must
     * acquire this lock before proceeding.
     *
     * This keeps the lock acquisition order consistent
     * and prevents competing resets from deadlocking.
     */
    const lockedUser = await transaction.execute(
      sql`
        SELECT ${users.id}
        FROM ${users}
        WHERE ${users.id} = ${tokenOwner.userId}
        FOR UPDATE
      `,
    )

    if (lockedUser.rows.length === 0) {
      return false
    }

    /**
     * Step 3: Atomically claim the token.
     *
     * We check validity again after acquiring the user lock
     * because another transaction might have consumed it.
     */
    const now = new Date()

    const [claimedToken] = await transaction
      .update(passwordResetTokens)
      .set({
        usedAt: now,
      })
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, now),
        ),
      )
      .returning({
        userId: passwordResetTokens.userId,
      })

    if (!claimedToken) {
      return false
    }

    /**
     * Step 4: Update the password and session version.
     *
     * Increasing sessionVersion invalidates existing JWTs
     * when requireAuth checks their version.
     */
    const [updatedUser] = await transaction
      .update(users)
      .set({
        passwordHash: newPasswordHash,
        sessionVersion: sql`${users.sessionVersion} + 1`,
      })
      .where(eq(users.id, claimedToken.userId))
      .returning({
        id: users.id,
      })

    if (!updatedUser) {
      throw new Error('Password reset could not update the account.')
    }

    /**
     * Step 5: Invalidate any other unused reset tokens
     * belonging to this account.
     */
    await transaction
      .update(passwordResetTokens)
      .set({
        usedAt: now,
      })
      .where(
        and(
          eq(passwordResetTokens.userId, claimedToken.userId),
          isNull(passwordResetTokens.usedAt),
        ),
      )

    return true
  })
}

/**
 * Checks whether a reset token is usable.
 *
 * This inexpensive lookup runs before bcrypt hashing.
 *
 * The final validation always happens inside the
 * redemption transaction.
 */
export async function isPasswordResetTokenUsable(
  tokenHash: string,
): Promise<boolean> {
  const [token] = await db
    .select({
      id: passwordResetTokens.id,
    })
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date()),
      ),
    )
    .limit(1)

  return token !== undefined
}
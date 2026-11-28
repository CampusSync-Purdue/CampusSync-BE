import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { after, before, describe, it } from 'node:test'
import { pool } from '../config/database.js'
import {
  insertPasswordResetToken,
  redeemPasswordResetToken,
} from './passwordResetRepository.js'
import {
  cleanUpTestData,
  closeTestDatabase,
  insertTestUser,
  setupTestDatabase,
  testTag,
} from '../test/database.js'

const tag = testTag('password-reset-concurrency')

function createTokenHash(): string {
  return createHash('sha256')
    .update(randomBytes(32))
    .digest('hex')
}

async function getUserState(userId: string) {
  const result = await pool.query<{
    password_hash: string
    session_version: number
  }>(
    `SELECT password_hash, session_version
     FROM users
     WHERE id = $1`,
    [userId],
  )

  return result.rows[0]
}

describe('CSYNC-29 concurrent password resets', () => {
  before(async () => {
    await setupTestDatabase()
  })

  after(async () => {
    try {
      await cleanUpTestData(tag)
    } finally {
      await closeTestDatabase()
    }
  })

  it('allows only one redemption of the same token', async () => {
    const userId = await insertTestUser(tag, '-same-token')
    const tokenHash = createTokenHash()

    await insertPasswordResetToken(
      userId,
      tokenHash,
      new Date(Date.now() + 30 * 60 * 1000),
    )

    const results = await Promise.all([
      redeemPasswordResetToken(tokenHash, 'new-hash'),
      redeemPasswordResetToken(tokenHash, 'new-hash'),
    ])

    assert.equal(results.filter(Boolean).length, 1)

    const user = await getUserState(userId)

    assert.equal(user.password_hash, 'new-hash')
    assert.equal(user.session_version, 1)
  })

  it('allows only one of two different valid tokens to reset an account', async () => {
    const userId = await insertTestUser(tag, '-different-tokens')

    const firstTokenHash = createTokenHash()
    const secondTokenHash = createTokenHash()
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000)

    await Promise.all([
      insertPasswordResetToken(userId, firstTokenHash, expiresAt),
      insertPasswordResetToken(userId, secondTokenHash, expiresAt),
    ])

    const results = await Promise.all([
      redeemPasswordResetToken(firstTokenHash, 'first-password-hash'),
      redeemPasswordResetToken(secondTokenHash, 'second-password-hash'),
    ])

    assert.equal(
      results.filter(Boolean).length,
      1,
      'Exactly one reset should succeed',
    )

    const user = await getUserState(userId)

    assert.equal(user.session_version, 1)

    assert.ok(
      ['first-password-hash', 'second-password-hash'].includes(
        user.password_hash,
      ),
    )

    const remainingTokens = await pool.query<{
      count: number
    }>(
      `SELECT COUNT(*)::int AS count
       FROM password_reset_tokens
       WHERE user_id = $1
         AND used_at IS NULL`,
      [userId],
    )

    assert.equal(
      remainingTokens.rows[0].count,
      0,
      'All other reset tokens should be invalidated',
    )
  })
})
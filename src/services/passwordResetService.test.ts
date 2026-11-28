import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import bcrypt from 'bcryptjs'
import request from 'supertest'
import app from '../app.js'
import { pool } from '../config/database.js'
import { insertPasswordResetToken } from '../repositories/passwordResetRepository.js'
import {
  cleanUpTestData,
  closeTestDatabase,
  insertTestUser,
  setupTestDatabase,
  testTag,
} from '../test/database.js'
import {
  generatePasswordResetToken,
  hashPasswordResetToken,
} from './passwordResetToken.js'
import { requestPasswordReset } from './passwordResetService.js'

const tag = testTag('password-reset')
const email = `${tag}@example.test`

const oldPassword = 'OldPassword1'
const newPassword = 'NewPassword1'

const originalResetUrl = process.env.PASSWORD_RESET_URL

let userId = ''
let resetToken = ''

describe('CSYNC-29 password-reset integration', () => {
  before(async () => {
    // Refuses to run unless the database name ends in "_test".
    await setupTestDatabase()

    userId = await insertTestUser(tag)

    const passwordHash = await bcrypt.hash(oldPassword, 12)

    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [passwordHash, userId],
    )

    process.env.PASSWORD_RESET_URL =
      'http://localhost:5173/reset-password'
  })

  after(async () => {
    if (originalResetUrl === undefined) {
      delete process.env.PASSWORD_RESET_URL
    } else {
      process.env.PASSWORD_RESET_URL = originalResetUrl
    }

    await cleanUpTestData(tag)
    await closeTestDatabase()
  })

  it('returns a neutral response for an unknown email', async () => {
    const response = await request(app)
      .post('/api/auth/forgot-password')
      .send({
        email: `unknown-${tag}@example.test`,
      })

    assert.equal(response.status, 200)
    assert.match(response.body.message, /If an account/)
  })

  it('generates a reset link and stores only the token hash', async () => {
    let deliveredTo = ''
    let deliveredUrl = ''

    await requestPasswordReset(
      email,
      async (recipientEmail, resetUrl) => {
        deliveredTo = recipientEmail
        deliveredUrl = resetUrl
      },
    )

    assert.equal(deliveredTo, email)
    assert.ok(deliveredUrl)

    const url = new URL(deliveredUrl)

    assert.equal(url.origin, 'http://localhost:5173')

    resetToken = url.searchParams.get('token') ?? ''

    assert.match(resetToken, /^[a-f0-9]{64}$/)

    const result = await pool.query<{
      token_hash: string
      used_at: Date | null
      expires_at: Date
    }>(
      `SELECT token_hash, used_at, expires_at
       FROM password_reset_tokens
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId],
    )

    assert.equal(result.rows.length, 1)

    const stored = result.rows[0]

    assert.equal(
      stored.token_hash,
      hashPasswordResetToken(resetToken),
    )

    assert.notEqual(stored.token_hash, resetToken)
    assert.equal(stored.used_at, null)
    assert.ok(stored.expires_at.getTime() > Date.now())
  })

  it('rejects mismatched password confirmation', async () => {
    const response = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: resetToken,
        newPassword,
        confirmPassword: 'DifferentPassword1',
      })

    assert.equal(response.status, 400)
    assert.match(response.body.message, /do not match/)
  })

  it('rejects weak passwords', async () => {
    const response = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: resetToken,
        newPassword: 'weak',
        confirmPassword: 'weak',
      })

    assert.equal(response.status, 400)
    assert.match(response.body.message, /at least 8 characters/)
  })

  it('changes the password and invalidates the old session', async () => {
    const oldLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email,
        password: oldPassword,
      })

    assert.equal(oldLogin.status, 200)
    assert.ok(oldLogin.body.token)

    const beforeReset = await request(app)
      .get('/api/auth/me')
      .set('authorization', `Bearer ${oldLogin.body.token}`)

    assert.equal(beforeReset.status, 200)

    const resetResponse = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: resetToken,
        newPassword,
        confirmPassword: newPassword,
      })

    assert.equal(resetResponse.status, 200)

    // The old JWT must no longer authenticate.
    const oldSession = await request(app)
      .get('/api/auth/me')
      .set('authorization', `Bearer ${oldLogin.body.token}`)

    assert.equal(oldSession.status, 401)

    // The original password must stop working.
    const rejectedLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email,
        password: oldPassword,
      })

    assert.equal(rejectedLogin.status, 401)

    // The new password must work.
    const newLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email,
        password: newPassword,
      })

    assert.equal(newLogin.status, 200)
    assert.ok(newLogin.body.token)

    const newSession = await request(app)
      .get('/api/auth/me')
      .set('authorization', `Bearer ${newLogin.body.token}`)

    assert.equal(newSession.status, 200)

    // The reset token cannot be reused.
    const reusedToken = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: resetToken,
        newPassword: 'AnotherPassword1',
        confirmPassword: 'AnotherPassword1',
      })

    assert.equal(reusedToken.status, 400)

    const result = await pool.query<{
      session_version: number
    }>(
      'SELECT session_version FROM users WHERE id = $1',
      [userId],
    )

    assert.equal(result.rows[0].session_version, 1)
  })

  it('rejects expired reset tokens', async () => {
    const expired = generatePasswordResetToken()

    await insertPasswordResetToken(
      userId,
      expired.tokenHash,
      new Date(Date.now() - 60_000),
    )

    const response = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: expired.token,
        newPassword: 'AnotherPassword1',
        confirmPassword: 'AnotherPassword1',
      })

    assert.equal(response.status, 400)
    assert.match(response.body.message, /invalid or has expired/)
  })

  it('rejects unknown reset tokens', async () => {
    const unknown = generatePasswordResetToken()

    const response = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: unknown.token,
        newPassword: 'AnotherPassword1',
        confirmPassword: 'AnotherPassword1',
      })

    assert.equal(response.status, 400)
    assert.match(response.body.message, /invalid or has expired/)
  })
})
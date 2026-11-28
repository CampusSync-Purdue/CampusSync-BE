import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import request from 'supertest'
import app from '../app.js'
import { pool } from '../config/database.js'
import {
  closeTestDatabase,
  setupTestDatabase,
} from '../test/database.js'

describe('CSYNC-29 forgot-password response timing', () => {
  before(async () => {
    await setupTestDatabase()
  })

  after(async () => {
    await closeTestDatabase()
  })

  it('responds without waiting for the user lookup', async () => {
    const client = await pool.connect()

    let timeout: ReturnType<typeof setTimeout> | undefined

    try {
      await client.query('BEGIN')

      // Temporarily block lookups against the users table.
      // This runs only in the isolated test database.
      await client.query(
        'LOCK TABLE users IN ACCESS EXCLUSIVE MODE',
      )

      const responsePromise = request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'nonexistent-password-reset@example.test',
        })
        .then((response) => response)

      const deadline = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          reject(
            new Error(
              'The endpoint waited for the database lookup.',
            ),
          )
        }, 2000)
      })

      const response = await Promise.race([
        responsePromise,
        deadline,
      ])

      assert.equal(response.status, 200)

      assert.equal(
        response.body.message,
        'If an account with that email address exists, you will receive password-reset instructions.',
      )
    } finally {
      if (timeout) {
        clearTimeout(timeout)
      }

      // Release the lock even if the test fails.
      await client.query('ROLLBACK')
      client.release()
    }
  })
})
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import bcrypt from 'bcryptjs'
import request from 'supertest'
import app from '../app.js'
import { pool } from '../config/database.js'
import { deleteTestUserByEmail, isDatabaseReachable } from '../test/database.js'

/**
 * Sign-in used to read a hardcoded demo array while registration wrote to an
 * in-memory one and the administrator bootstrap wrote to the database, so
 * neither a registered user nor the bootstrapped administrator could sign in.
 * These cases cover the whole round trip against the one table.
 */
const databaseReachable = await isDatabaseReachable()

const studentEmail = `login-student+${process.pid}@example.test`
const adminEmail = `login-admin+${process.pid}@example.test`
const password = 'Password1'

describe('sign-in', { skip: !databaseReachable }, () => {
  before(async () => {
    await deleteTestUserByEmail(studentEmail)
    await deleteTestUserByEmail(adminEmail)

    // Stands in for `npm run bootstrap-admin`, which writes the same row.
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'admin')`,
      ['Bootstrapped Admin', adminEmail, await bcrypt.hash(password, 12)],
    )
  })

  after(async () => {
    await deleteTestUserByEmail(studentEmail)
    await deleteTestUserByEmail(adminEmail)
    await pool.end()
  })

  function login(email: string, suppliedPassword: string) {
    return request(app)
      .post('/api/auth/login')
      .send({ email, password: suppliedPassword })
  }

  describe('a registered user', () => {
    before(async () => {
      const registered = await request(app).post('/api/auth/register').send({
        name: 'Login Student',
        email: studentEmail,
        password,
      })

      assert.equal(registered.status, 201, 'registration should have succeeded')
    })

    it('can sign in with the password it registered with', async () => {
      const response = await login(studentEmail, password)

      assert.equal(response.status, 200)
      assert.ok(response.body.token, 'expected a token')
      assert.equal(response.body.user.email, studentEmail)
    })

    it('is given the default user role', async () => {
      const response = await login(studentEmail, password)

      assert.equal(response.body.user.role, 'user')
    })

    it('never receives password data', async () => {
      const response = await login(studentEmail, password)

      assert.equal(response.body.user.passwordHash, undefined)
      assert.ok(!JSON.stringify(response.body).includes(password))
    })

    it('can sign in regardless of the casing it types', async () => {
      const response = await login(studentEmail.toUpperCase(), password)

      assert.equal(response.status, 200)
    })

    it('can use the token on an authenticated route', async () => {
      const { body } = await login(studentEmail, password)

      const me = await request(app)
        .get('/api/auth/me')
        .set('authorization', `Bearer ${body.token}`)

      assert.equal(me.status, 200)
      assert.equal(me.body.user.email, studentEmail)
    })

    it('can read its own bookings with that token', async () => {
      const { body } = await login(studentEmail, password)

      const bookings = await request(app)
        .get('/api/reservations/me')
        .set('authorization', `Bearer ${body.token}`)

      assert.equal(bookings.status, 200)
      assert.deepEqual(bookings.body, { upcoming: [], past: [] })
    })

    it('is refused with the wrong password', async () => {
      const response = await login(studentEmail, 'WrongPassword1')

      assert.equal(response.status, 401)
      assert.equal(response.body.token, undefined)
    })
  })

  describe('the bootstrapped administrator', () => {
    it('can sign in', async () => {
      const response = await login(adminEmail, password)

      assert.equal(response.status, 200)
      assert.ok(response.body.token)
    })

    it('is given the admin role, so admin routes accept the token', async () => {
      const { body } = await login(adminEmail, password)

      assert.equal(body.user.role, 'admin')

      const reservations = await request(app)
        .get('/api/reservations')
        .set('authorization', `Bearer ${body.token}`)

      assert.equal(reservations.status, 200)
    })
  })

  describe('an unknown email', () => {
    it('is refused', async () => {
      const response = await login('nobody@example.test', password)

      assert.equal(response.status, 401)
    })

    it('is refused with the same message as a wrong password', async () => {
      const unknown = await login('nobody@example.test', password)
      const wrong = await login(studentEmail, 'WrongPassword1')

      // Identical wording, so the response cannot be used to discover which
      // email addresses have accounts.
      assert.equal(unknown.body.message, wrong.body.message)
    })
  })
})

if (!databaseReachable) {
  await pool.end()
}

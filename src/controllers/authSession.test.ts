import assert from 'node:assert/strict'
import { after, afterEach, before, beforeEach, describe, it } from 'node:test'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../config/environment.js'
import { isUuid } from '../validation/uuid.js'
import {
  closeTestDatabase,
  resetTestDatabase,
  setupTestDatabase,
} from '../test/database.js'
import { startTestServer } from '../test/server.js'

type LoginBody = {
  token?: string
  message?: string
  user?: Record<string, unknown>
}

const account = {
  name: 'Jordan Lee',
  email: 'jordan@campussync.edu',
  password: 'Password1',
}

let server: Awaited<ReturnType<typeof startTestServer>>

before(async () => {
  await setupTestDatabase()
  await resetTestDatabase()
  server = await startTestServer()
})

after(async () => {
  await server.close()
  await closeTestDatabase()
})

beforeEach(async () => {
  const response = await server.request('POST', '/api/auth/register', { body: account })
  assert.equal(response.status, 201)
})

afterEach(async () => {
  await resetTestDatabase()
})

function login(email: string, password: string) {
  return server.request<LoginBody>('POST', '/api/auth/login', { body: { email, password } })
}

describe('POST /api/auth/login', () => {
  it('signs in a registered user and issues a token with their database id', async () => {
    const response = await login(account.email, account.password)

    assert.equal(response.status, 200)
    assert.ok(response.body.token)

    const payload = jwt.verify(response.body.token, JWT_SECRET) as Record<string, unknown>

    assert.ok(isUuid(payload.id), 'token id should be a UUID')
    assert.equal(payload.id, response.body.user?.id)
    assert.equal(payload.role, 'user')
  })

  it('matches the email case-insensitively', async () => {
    const response = await login('JORDAN@CampusSync.edu', account.password)

    assert.equal(response.status, 200)
  })

  it('never returns password data', async () => {
    const response = await login(account.email, account.password)

    assert.equal(response.body.user?.passwordHash, undefined)
    assert.ok(!response.rawBody.toLowerCase().includes('passwordhash'))
  })

  it('rejects a wrong password with 401', async () => {
    const response = await login(account.email, 'WrongPassword1')

    assert.equal(response.status, 401)
    assert.equal(response.body.token, undefined)
  })

  it('rejects an unknown email with 401', async () => {
    const response = await login('nobody@campussync.edu', account.password)

    assert.equal(response.status, 401)
  })

  it('rejects missing credentials with 400', async () => {
    const response = await login('', '')

    assert.equal(response.status, 400)
  })
})

describe('GET /api/auth/me', () => {
  it('returns the signed-in user', async () => {
    const { body } = await login(account.email, account.password)

    const response = await server.request<{ user?: Record<string, unknown> }>(
      'GET',
      '/api/auth/me',
      { token: body.token },
    )

    assert.equal(response.status, 200)
    assert.equal(response.body.user?.email, account.email)
    assert.equal(response.body.user?.passwordHash, undefined)
  })

  it('returns 401 without a token', async () => {
    const response = await server.request('GET', '/api/auth/me')

    assert.equal(response.status, 401)
  })

  it('returns 401 for a valid token whose user does not exist', async () => {
    const staleToken = jwt.sign(
      {
        id: '00000000-0000-4000-8000-000000000000',
        email: 'gone@campussync.edu',
        name: 'Gone',
        role: 'user',
      },
      JWT_SECRET,
    )

    const response = await server.request('GET', '/api/auth/me', { token: staleToken })

    assert.equal(response.status, 401)
  })

  it('returns 401 for a legacy token with a non-UUID id', async () => {
    const legacyToken = jwt.sign(
      { id: 'user-1', email: 'student@pfw.edu', name: 'Legacy', role: 'user' },
      JWT_SECRET,
    )

    const response = await server.request('GET', '/api/auth/me', { token: legacyToken })

    assert.equal(response.status, 401)
  })
})

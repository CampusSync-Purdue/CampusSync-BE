import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import express from 'express'
import request from 'supertest'
import jwt from 'jsonwebtoken'

import { JWT_SECRET } from '../config/environment.js'
import { requireAuth } from './requireAuth.js'
import { requireRole } from './requireRole.js'
import type { AuthTokenPayload } from '../types/index.js'

function createTestApp() {
  const app = express()

  app.get(
    '/admin',
    requireAuth,
    requireRole('admin'),
    (_request, response) => {
      response.status(200).json({ message: 'Access granted.' })
    },
  )

  return app
}

function createToken(role: string) {
  const payload = {
    id: 'test-user',
    email: 'test@example.com',
    name: 'Test User',
    role,
  }

  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' })
}

describe('Role-based authorization', () => {
  const app = createTestApp()

  it('returns 401 when no token is provided', async () => {
    const response = await request(app).get('/admin')

    assert.equal(response.status, 401)
  })

  it('returns 403 when a regular user accesses an admin route', async () => {
    const token = createToken('user')

    const response = await request(app)
      .get('/admin')
      .set('Authorization', `Bearer ${token}`)

    assert.equal(response.status, 403)
  })

  it('allows administrators to access an admin route', async () => {
    const token = createToken('admin')

    const response = await request(app)
      .get('/admin')
      .set('Authorization', `Bearer ${token}`)

    assert.equal(response.status, 200)
    assert.equal(response.body.message, 'Access granted.')
  })

  it('rejects a token containing an invalid role', async () => {
    const token = createToken('superadmin')

    const response = await request(app)
      .get('/admin')
      .set('Authorization', `Bearer ${token}`)

    assert.equal(response.status, 401)
  })
})

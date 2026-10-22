import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import request from 'supertest'
import app from '../app.js'
import { pool } from '../config/database.js'
import { signTestToken } from '../test/auth.js'
import {
  cleanUpTestData,
  insertTestUser,
  isDatabaseReachable,
  testTag,
} from '../test/database.js'

const databaseReachable = await isDatabaseReachable()
const tag = testTag('create-room')

function roomPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: `${tag}-room`,
    // `location` carries the run's tag so clean-up can find it.
    location: tag,
    capacity: 8,
    description: 'A quiet room.',
    amenities: ['WiFi'],
    availabilityHours: { wednesday: { open: '08:00', close: '22:00' } },
    ...overrides,
  }
}

describe('POST /api/rooms', { skip: !databaseReachable }, () => {
  let adminToken: string
  let userToken: string

  before(async () => {
    await cleanUpTestData(tag)

    const adminId = await insertTestUser(tag, '-admin')
    const userId = await insertTestUser(tag, '-user')

    adminToken = signTestToken({ id: adminId, role: 'admin' })
    userToken = signTestToken({ id: userId, role: 'user' })
  })

  after(async () => {
    await cleanUpTestData(tag)
    await pool.end()
  })

  function post(payload: object, token?: string) {
    const pending = request(app).post('/api/rooms').send(payload)

    return token ? pending.set('authorization', `Bearer ${token}`) : pending
  }

  describe('authorization', () => {
    it('rejects an unauthenticated request', async () => {
      const response = await post(roomPayload())

      assert.equal(response.status, 401)
    })

    it('rejects a regular user', async () => {
      const response = await post(roomPayload(), userToken)

      assert.equal(response.status, 403)
    })

    it('allows an administrator', async () => {
      const response = await post(
        roomPayload({ name: `${tag}-allowed` }),
        adminToken,
      )

      assert.equal(response.status, 201)
    })

    it('does not create a room for a rejected caller', async () => {
      await post(roomPayload({ name: `${tag}-forbidden` }), userToken)

      const stored = await pool.query(
        'SELECT 1 FROM rooms WHERE name = $1',
        [`${tag}-forbidden`],
      )

      assert.equal(stored.rowCount, 0)
    })
  })

  describe('creation', () => {
    it('returns the created room', async () => {
      const response = await post(
        roomPayload({ name: `${tag}-returned`, capacity: 12 }),
        adminToken,
      )

      assert.equal(response.status, 201)
      assert.equal(response.body.room.name, `${tag}-returned`)
      assert.equal(response.body.room.capacity, 12)
      assert.deepEqual(response.body.room.amenities, ['WiFi'])
    })

    it('persists the operating hours it was given', async () => {
      const response = await post(
        roomPayload({
          name: `${tag}-hours`,
          availabilityHours: { friday: { open: '09:00', close: '17:00' } },
        }),
        adminToken,
      )

      assert.deepEqual(response.body.room.availabilityHours, {
        friday: { open: '09:00', close: '17:00' },
      })
    })

    it('creates the room active, so it reaches the catalog', async () => {
      const name = `${tag}-in-catalog`
      await post(roomPayload({ name }), adminToken)

      const catalog = await request(app).get('/api/rooms')

      assert.ok(
        catalog.body.some((room: { name: string }) => room.name === name),
        'a newly created room must appear in the catalog',
      )
    })

    it('offers the new room in the availability search', async () => {
      const name = `${tag}-searchable`
      await post(
        roomPayload({
          name,
          availabilityHours: { wednesday: { open: '08:00', close: '22:00' } },
        }),
        adminToken,
      )

      // 2026-10-21 is a Wednesday.
      const search = await request(app)
        .get('/api/rooms/availability')
        .query({ date: '2026-10-21', startTime: '14:00', endTime: '16:00' })

      assert.ok(
        search.body.rooms.some((room: { name: string }) => room.name === name),
        'a newly created room must be bookable straight away',
      )
    })
  })

  describe('validation', () => {
    it('rejects a room with no name', async () => {
      const response = await post(roomPayload({ name: '' }), adminToken)

      assert.equal(response.status, 400)
      assert.ok(response.body.errors.name)
    })

    it('rejects a room with no operating hours', async () => {
      const response = await post(
        roomPayload({ name: `${tag}-no-hours`, availabilityHours: {} }),
        adminToken,
      )

      assert.equal(response.status, 400)
      assert.ok(response.body.errors.availabilityHours)
    })

    it('rejects a capacity below 1', async () => {
      const response = await post(
        roomPayload({ name: `${tag}-bad-capacity`, capacity: 0 }),
        adminToken,
      )

      assert.equal(response.status, 400)
      assert.ok(response.body.errors.capacity)
    })

    it('reports every invalid field at once', async () => {
      const response = await post({}, adminToken)

      assert.equal(response.status, 400)
      assert.ok(response.body.errors.name)
      assert.ok(response.body.errors.location)
      assert.ok(response.body.errors.capacity)
      assert.ok(response.body.errors.availabilityHours)
    })
  })
})

if (!databaseReachable) {
  await pool.end()
}

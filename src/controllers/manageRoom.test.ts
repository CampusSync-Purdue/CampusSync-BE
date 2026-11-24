import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import request from 'supertest'
import app from '../app.js'
import { pool } from '../config/database.js'
import { signTestToken } from '../test/auth.js'
import {
  cleanUpTestData,
  insertTestReservation,
  insertTestRoom,
  insertTestUser,
  isDatabaseReachable,
  testTag,
} from '../test/database.js'

const databaseReachable = await isDatabaseReachable()
const tag = testTag('manage-room')

const OPERATING_HOURS = {
  monday: { open: '08:00', close: '20:00' },
  tuesday: { open: '08:00', close: '20:00' },
  wednesday: { open: '08:00', close: '20:00' },
  thursday: { open: '08:00', close: '20:00' },
  friday: { open: '08:00', close: '20:00' },
  saturday: { open: '08:00', close: '20:00' },
  sunday: { open: '08:00', close: '20:00' },
}

function roomPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: `${tag}-updated`,
    location: tag,
    capacity: 12,
    description: 'Updated room description.',
    amenities: ['WiFi', 'Projector'],
    availabilityHours: OPERATING_HOURS,
    ...overrides,
  }
}

function futureDate(): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + 7)
  return date.toISOString().slice(0, 10)
}

async function createTestRoom(name: string, isActive = true) {
  return insertTestRoom({
    tag,
    name: `${tag}-${name}`,
    isActive,
    availabilityHours: OPERATING_HOURS,
  })
}

describe('CSYNC-23 administrator room management', {
  skip: !databaseReachable,
}, () => {
  let adminToken: string
  let userToken: string
  let userId: string

  before(async () => {
    await cleanUpTestData(tag)

    const adminId = await insertTestUser(tag, '-admin')
    userId = await insertTestUser(tag, '-user')

    adminToken = signTestToken({
      id: adminId,
      role: 'admin',
    })

    userToken = signTestToken({
      id: userId,
      role: 'user',
    })
  })

  after(async () => {
    await cleanUpTestData(tag)
    await pool.end()
  })

  it('allows administrators to list active and inactive rooms', async () => {
    const activeId = await createTestRoom('active')
    const inactiveId = await createTestRoom('inactive', false)

    const response = await request(app)
      .get('/api/rooms/admin')
      .set('authorization', `Bearer ${adminToken}`)

    assert.equal(response.status, 200)

    const active = response.body.find(
      (room: { id: string }) => room.id === activeId,
    )

    const inactive = response.body.find(
      (room: { id: string }) => room.id === inactiveId,
    )

    assert.equal(active?.isActive, true)
    assert.equal(inactive?.isActive, false)
  })

  it('prevents regular users from accessing administrator room lists', async () => {
    const response = await request(app)
      .get('/api/rooms/admin')
      .set('authorization', `Bearer ${userToken}`)

    assert.equal(response.status, 403)
  })

  it('allows administrators to retrieve an inactive room by ID', async () => {
    const roomId = await createTestRoom('admin-details', false)

    const response = await request(app)
      .get(`/api/rooms/admin/${roomId}`)
      .set('authorization', `Bearer ${adminToken}`)

    assert.equal(response.status, 200)
    assert.equal(response.body.id, roomId)
    assert.equal(response.body.isActive, false)
  })

  it('allows administrators to update room information', async () => {
    const roomId = await createTestRoom('editable')

    const response = await request(app)
      .put(`/api/rooms/${roomId}`)
      .set('authorization', `Bearer ${adminToken}`)
      .send(roomPayload())

    assert.equal(response.status, 200)
    assert.equal(response.body.room.name, `${tag}-updated`)
    assert.equal(response.body.room.capacity, 12)
    assert.equal(
      response.body.room.description,
      'Updated room description.',
    )
    assert.deepEqual(
      response.body.room.amenities,
      ['WiFi', 'Projector'],
    )
    assert.equal(response.body.room.isActive, true)

    const stored = await pool.query<{
      name: string
      capacity: number
    }>(
      'SELECT name, capacity FROM rooms WHERE id = $1',
      [roomId],
    )

    assert.equal(stored.rows[0].name, `${tag}-updated`)
    assert.equal(stored.rows[0].capacity, 12)
  })

  it('rejects invalid updates without changing the room', async () => {
    const roomId = await createTestRoom('invalid-update')

    const response = await request(app)
      .put(`/api/rooms/${roomId}`)
      .set('authorization', `Bearer ${adminToken}`)
      .send(roomPayload({ capacity: 0 }))

    assert.equal(response.status, 400)
    assert.ok(response.body.errors.capacity)

    const stored = await pool.query<{ capacity: number }>(
      'SELECT capacity FROM rooms WHERE id = $1',
      [roomId],
    )

    assert.equal(stored.rows[0].capacity, 10)
  })

  it('prevents regular users from editing rooms', async () => {
    const roomId = await createTestRoom('protected-update')

    const response = await request(app)
      .put(`/api/rooms/${roomId}`)
      .set('authorization', `Bearer ${userToken}`)
      .send(roomPayload())

    assert.equal(response.status, 403)

    const stored = await pool.query<{ name: string }>(
      'SELECT name FROM rooms WHERE id = $1',
      [roomId],
    )

    assert.equal(stored.rows[0].name, `${tag}-protected-update`)
  })

  it('deactivates a room and removes it from public searches', async () => {
    const roomId = await createTestRoom('deactivate')

    const response = await request(app)
      .post(`/api/rooms/${roomId}/deactivate`)
      .set('authorization', `Bearer ${adminToken}`)

    assert.equal(response.status, 200)
    assert.equal(response.body.room.isActive, false)

    const stored = await pool.query<{ is_active: boolean }>(
      'SELECT is_active FROM rooms WHERE id = $1',
      [roomId],
    )

    assert.equal(stored.rows[0].is_active, false)

    const catalog = await request(app).get('/api/rooms')

    assert.equal(
      catalog.body.some(
        (room: { id: string }) => room.id === roomId,
      ),
      false,
    )

    const search = await request(app)
      .get('/api/rooms/availability')
      .query({
        date: futureDate(),
        startTime: '14:00',
        endTime: '15:00',
      })

    assert.equal(search.status, 200)
    assert.equal(
      search.body.rooms.some(
        (room: { id: string }) => room.id === roomId,
      ),
      false,
    )
  })

  it('preserves reservation history after room deactivation', async () => {
    const roomId = await createTestRoom('history')

    const reservationId = await insertTestReservation({
      userId,
      roomId,
      startUtc: '2026-12-02T15:00:00.000Z',
      endUtc: '2026-12-02T16:00:00.000Z',
    })

    const response = await request(app)
      .post(`/api/rooms/${roomId}/deactivate`)
      .set('authorization', `Bearer ${adminToken}`)

    assert.equal(response.status, 200)

    const stored = await pool.query<{
      id: string
      room_id: string
    }>(
      'SELECT id, room_id FROM reservations WHERE id = $1',
      [reservationId],
    )

    assert.equal(stored.rows[0]?.id, reservationId)
    assert.equal(stored.rows[0]?.room_id, roomId)
  })

  it('prevents regular users from deactivating rooms', async () => {
    const roomId = await createTestRoom('protected-deactivate')

    const response = await request(app)
      .post(`/api/rooms/${roomId}/deactivate`)
      .set('authorization', `Bearer ${userToken}`)

    assert.equal(response.status, 403)

    const stored = await pool.query<{ is_active: boolean }>(
      'SELECT is_active FROM rooms WHERE id = $1',
      [roomId],
    )

    assert.equal(stored.rows[0].is_active, true)
  })

  it('does not report a second deactivation as successful', async () => {
    const roomId = await createTestRoom('repeat-deactivate')

    const endpoint = `/api/rooms/${roomId}/deactivate`

    const first = await request(app)
      .post(endpoint)
      .set('authorization', `Bearer ${adminToken}`)

    const second = await request(app)
      .post(endpoint)
      .set('authorization', `Bearer ${adminToken}`)

    assert.equal(first.status, 200)
    assert.equal(second.status, 404)
  })
})

if (!databaseReachable) {
  await pool.end()
}

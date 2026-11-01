import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import request from 'supertest'
import app from '../app.js'
import { pool } from '../config/database.js'
import {
  cleanUpTestData,
  insertTestRoom,
  isDatabaseReachable,
  testTag,
} from '../test/database.js'

/**
 * Room endpoint integration tests run against the real database.
 */
const databaseReachable = await isDatabaseReachable()
const tag = testTag('room-endpoints')

let activeRoomId = ''
let inactiveRoomId = ''

describe('Room endpoints', { skip: !databaseReachable }, () => {
  before(async () => {
    activeRoomId = await insertTestRoom({
      tag,
      name: `${tag} Active Room`,
      capacity: 8,
      availabilityHours: {
        monday: { open: '08:00', close: '22:00' },
      },
    })

    inactiveRoomId = await insertTestRoom({
      tag,
      name: `${tag} Inactive Room`,
      isActive: false,
    })
  })

  after(async () => {
    await cleanUpTestData(tag)
    await pool.end()
  })

  describe('GET /api/rooms', () => {
    it('returns active rooms from the database and excludes inactive rooms', async () => {
      const response = await request(app).get('/api/rooms')

      assert.equal(response.status, 200)
      assert.ok(Array.isArray(response.body))

      const activeRoom = response.body.find(
        (room: { id: string }) => room.id === activeRoomId,
      )
      const inactiveRoom = response.body.find(
        (room: { id: string }) => room.id === inactiveRoomId,
      )

      assert.equal(activeRoom?.name, `${tag} Active Room`)
      assert.equal(inactiveRoom, undefined)
    })
  })

  describe('GET /api/rooms/:roomId', () => {
    it('returns an active room by id', async () => {
      const response = await request(app).get(`/api/rooms/${activeRoomId}`)

      assert.equal(response.status, 200)
      assert.equal(response.body.id, activeRoomId)
      assert.equal(response.body.name, `${tag} Active Room`)
      assert.equal(response.body.capacity, 8)
    })

    it('reports an inactive room as not found', async () => {
      const response = await request(app).get(`/api/rooms/${inactiveRoomId}`)

      assert.equal(response.status, 404)
      assert.deepEqual(response.body, { message: 'Room not found.' })
    })

    it('reports an unknown id as not found', async () => {
      const response = await request(app).get(
        '/api/rooms/11111111-2222-3333-4444-555555555555',
      )

      assert.equal(response.status, 404)
      assert.deepEqual(response.body, { message: 'Room not found.' })
    })

    it('reports a malformed id as not found rather than failing', async () => {
      const response = await request(app).get('/api/rooms/does-not-exist')

      assert.equal(response.status, 404)
      assert.deepEqual(response.body, { message: 'Room not found.' })
    })

    it('does not capture /api/rooms/availability', async () => {
      const response = await request(app).get('/api/rooms/availability')

      assert.equal(response.status, 400)
      assert.notDeepEqual(response.body, { message: 'Room not found.' })
    })
  })
})
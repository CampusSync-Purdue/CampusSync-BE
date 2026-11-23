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
const tag = testTag('admin-list')

type ListedReservation = {
  id: string
  startTime: string
  status: string
  room: { id: string; name: string }
  user: { id: string; name: string; email: string }
}

describe('GET /api/reservations (administrator list)', { skip: !databaseReachable }, () => {
  let ownerId: string
  let alphaRoomId: string
  let betaRoomId: string
  let adminToken: string
  let userToken: string
  const ids: Record<'upcoming' | 'cancelled' | 'completed' | 'otherRoom', string> = {
    upcoming: '',
    cancelled: '',
    completed: '',
    otherRoom: '',
  }

  before(async () => {
    await cleanUpTestData(tag)
    ownerId = await insertTestUser(tag, '-owner')
    const adminId = await insertTestUser(tag, '-admin')
    alphaRoomId = await insertTestRoom({ tag, name: `${tag}-Alpha` })
    betaRoomId = await insertTestRoom({ tag, name: `${tag}-beta` })
    adminToken = signTestToken({ id: adminId, role: 'admin' })
    userToken = signTestToken({ id: ownerId, role: 'user' })

    // 2090-03-10 14:00 UTC is 10:00 on campus (EDT, UTC-4).
    ids.upcoming = await insertTestReservation({
      userId: ownerId,
      roomId: alphaRoomId,
      startUtc: '2090-03-10T14:00:00.000Z',
      endUtc: '2090-03-10T15:00:00.000Z',
    })
    ids.cancelled = await insertTestReservation({
      userId: ownerId,
      roomId: alphaRoomId,
      startUtc: '2090-03-11T14:00:00.000Z',
      endUtc: '2090-03-11T15:00:00.000Z',
      status: 'cancelled',
    })
    // Stored as active but already ended, so it must be shown as completed.
    ids.completed = await insertTestReservation({
      userId: ownerId,
      roomId: alphaRoomId,
      startUtc: '2020-03-10T14:00:00.000Z',
      endUtc: '2020-03-10T15:00:00.000Z',
    })
    // 2090-03-11 03:30 UTC is still 23:30 on 2090-03-10 on campus.
    ids.otherRoom = await insertTestReservation({
      userId: ownerId,
      roomId: betaRoomId,
      startUtc: '2090-03-11T03:30:00.000Z',
      endUtc: '2090-03-11T04:00:00.000Z',
    })
  })

  after(async () => {
    await cleanUpTestData(tag)
    await pool.end()
  })

  /** Lists reservations, keeping only this run's rows so other data cannot interfere. */
  async function list(query: Record<string, string> = {}, token = adminToken) {
    const response = await request(app)
      .get('/api/reservations')
      .query(query)
      .set('authorization', `Bearer ${token}`)
    const ours = new Set(Object.values(ids))
    const reservations: ListedReservation[] = (response.body.reservations ?? []).filter(
      (reservation: ListedReservation) => ours.has(reservation.id),
    )
    return { response, reservations, order: reservations.map((r) => r.id) }
  }

  describe('authorization', () => {
    it('rejects an unauthenticated request', async () => {
      const response = await request(app).get('/api/reservations')
      assert.equal(response.status, 401)
    })

    it('rejects a regular user', async () => {
      const { response } = await list({}, userToken)
      assert.equal(response.status, 403)
      assert.equal(response.body.reservations, undefined)
    })
  })

  describe('contents', () => {
    it('includes the reserving user and room, without credentials', async () => {
      const { response, reservations } = await list()
      assert.equal(response.status, 200)

      const upcoming = reservations.find((r) => r.id === ids.upcoming)
      assert.ok(upcoming)
      assert.equal(upcoming.user.id, ownerId)
      assert.equal(upcoming.user.email, `${tag}-owner@example.test`)
      assert.equal(upcoming.user.name, `Test User ${tag}-owner`)
      assert.equal(upcoming.room.id, alphaRoomId)
      assert.equal(upcoming.startTime, '2090-03-10T14:00:00.000Z')
      assert.ok(!JSON.stringify(response.body).includes('password'))
    })

    it('shows derived statuses', async () => {
      const { reservations } = await list()
      const statusOf = (id: string) => reservations.find((r) => r.id === id)?.status
      assert.equal(statusOf(ids.upcoming), 'active')
      assert.equal(statusOf(ids.cancelled), 'cancelled')
      assert.equal(statusOf(ids.completed), 'completed')
    })
  })

  describe('filtering', () => {
    it('by campus-local date, including a late-evening booking that is the next day in UTC', async () => {
      const { order } = await list({ date: '2090-03-10' })
      assert.deepEqual(new Set(order), new Set([ids.upcoming, ids.otherRoom]))
    })

    it('by room', async () => {
      const { order } = await list({ roomId: betaRoomId })
      assert.deepEqual(order, [ids.otherRoom])
    })

    it('by derived status, so an ended active booking counts as completed', async () => {
      assert.deepEqual((await list({ status: 'completed' })).order, [ids.completed])
      assert.deepEqual((await list({ status: 'cancelled' })).order, [ids.cancelled])
      assert.deepEqual(
        new Set((await list({ status: 'active' })).order),
        new Set([ids.upcoming, ids.otherRoom]),
      )
    })

    it('combines filters', async () => {
      const { order } = await list({ roomId: alphaRoomId, date: '2090-03-10', status: 'active' })
      assert.deepEqual(order, [ids.upcoming])
    })

    it('rejects invalid filters with per-field messages', async () => {
      const { response } = await list({ date: '2090-02-30', status: 'pending', sort: 'user' })
      assert.equal(response.status, 400)
      assert.ok(response.body.errors.date)
      assert.ok(response.body.errors.status)
      assert.ok(response.body.errors.sort)
    })
  })

  describe('sorting', () => {
    it('defaults to newest first', async () => {
      const { order } = await list()
      assert.deepEqual(order, [ids.cancelled, ids.otherRoom, ids.upcoming, ids.completed])
    })

    it('by date ascending', async () => {
      const { order } = await list({ sort: 'date', order: 'asc' })
      assert.deepEqual(order, [ids.completed, ids.upcoming, ids.otherRoom, ids.cancelled])
    })

    it('by room name, case-insensitively, then by start time', async () => {
      const { order } = await list({ sort: 'room', order: 'asc' })
      assert.deepEqual(order, [ids.completed, ids.upcoming, ids.cancelled, ids.otherRoom])
    })

    it('by derived status', async () => {
      const { reservations } = await list({ sort: 'status', order: 'asc' })
      assert.deepEqual(
        reservations.map((r) => r.status),
        ['active', 'active', 'cancelled', 'completed'],
      )
    })
  })
})

if (!databaseReachable) {
  await pool.end()
}

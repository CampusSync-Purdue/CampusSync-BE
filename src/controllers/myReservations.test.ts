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
const tag = testTag('my-bookings')

type ViewedReservation = {
  id: string
  status: string
  timeframe: string
  startTime: string
  room: { name: string; location: string; capacity: number }
}

describe('GET /api/reservations/me', { skip: !databaseReachable }, () => {
  let ownerId: string
  let otherUserId: string
  let roomId: string
  let token: string

  // Fixed instants well clear of "now", so the derivation is unambiguous.
  const PAST_START = '2020-01-01T15:00:00.000Z'
  const PAST_END = '2020-01-01T16:00:00.000Z'
  const FUTURE_START = '2090-01-01T15:00:00.000Z'
  const FUTURE_END = '2090-01-01T16:00:00.000Z'
  const LATER_START = '2090-06-01T15:00:00.000Z'
  const LATER_END = '2090-06-01T16:00:00.000Z'

  before(async () => {
    await cleanUpTestData(tag)

    ownerId = await insertTestUser(tag, '-owner')
    otherUserId = await insertTestUser(tag, '-other')
    roomId = await insertTestRoom({ tag, name: `${tag}-room` })
    token = signTestToken({ id: ownerId })
  })

  after(async () => {
    await cleanUpTestData(tag)
    await pool.end()
  })

  function get() {
    return request(app)
      .get('/api/reservations/me')
      .set('authorization', `Bearer ${token}`)
  }

  it('requires authentication', async () => {
    const response = await request(app).get('/api/reservations/me')

    assert.equal(response.status, 401)
  })

  it('rejects a malformed token', async () => {
    const response = await request(app)
      .get('/api/reservations/me')
      .set('authorization', 'Bearer not-a-real-token')

    assert.equal(response.status, 401)
  })

  it('returns an upcoming active reservation in the upcoming section', async () => {
    const id = await insertTestReservation({
      userId: ownerId,
      roomId,
      startUtc: FUTURE_START,
      endUtc: FUTURE_END,
    })

    const response = await get()

    assert.equal(response.status, 200)

    const found = response.body.upcoming.find(
      (reservation: ViewedReservation) => reservation.id === id,
    )

    assert.ok(found, 'expected the reservation in the upcoming section')
    assert.equal(found.status, 'active')
    assert.equal(found.timeframe, 'upcoming')
  })

  it('includes the room so the page needs no second request', async () => {
    const response = await get()
    const [reservation] = response.body.upcoming

    assert.equal(reservation.room.name, `${tag}-room`)
    assert.equal(reservation.room.location, tag)
    assert.equal(typeof reservation.room.capacity, 'number')
  })

  it('reports a past active reservation as completed, in history', async () => {
    const id = await insertTestReservation({
      userId: ownerId,
      roomId,
      startUtc: PAST_START,
      endUtc: PAST_END,
    })

    const response = await get()

    const found = response.body.past.find(
      (reservation: ViewedReservation) => reservation.id === id,
    )

    assert.ok(found, 'expected the reservation in history')
    assert.equal(found.status, 'completed')
  })

  it('keeps a cancelled reservation cancelled, in history', async () => {
    const id = await insertTestReservation({
      userId: ownerId,
      roomId,
      startUtc: '2090-03-01T15:00:00.000Z',
      endUtc: '2090-03-01T16:00:00.000Z',
      status: 'cancelled',
    })

    const response = await get()

    const found = response.body.past.find(
      (reservation: ViewedReservation) => reservation.id === id,
    )

    assert.ok(found, 'a cancelled booking belongs to history even when future')
    assert.equal(found.status, 'cancelled')
  })

  it('returns upcoming reservations soonest first', async () => {
    await insertTestReservation({
      userId: ownerId,
      roomId,
      startUtc: LATER_START,
      endUtc: LATER_END,
    })

    const response = await get()
    const startTimes = response.body.upcoming.map(
      (reservation: ViewedReservation) => reservation.startTime,
    )

    assert.deepEqual(startTimes, [...startTimes].sort())
  })

  it('never returns another user\'s reservations', async () => {
    const otherId = await insertTestReservation({
      userId: otherUserId,
      roomId,
      startUtc: '2090-09-01T15:00:00.000Z',
      endUtc: '2090-09-01T16:00:00.000Z',
    })

    const response = await get()

    const everything = [...response.body.upcoming, ...response.body.past]

    assert.ok(
      !everything.some(
        (reservation: ViewedReservation) => reservation.id === otherId,
      ),
      'a caller must only see their own bookings',
    )
  })
})

if (!databaseReachable) {
  await pool.end()
}

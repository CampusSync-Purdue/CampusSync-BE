
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import jwt from 'jsonwebtoken'
import request from 'supertest'

import app from '../app.js'
import { pool } from '../config/database.js'
import { JWT_SECRET } from '../config/environment.js'
import {
  cleanUpTestData,
  insertTestReservation,
  insertTestRoom,
  insertTestUser,
  isDatabaseReachable,
  testTag,
} from '../test/database.js'

const databaseReachable = await isDatabaseReachable()
const tag = testTag('booking-conflicts')

const OPENING_HOURS = Object.fromEntries(
  [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ].map((day) => [day, { open: '08:00', close: '20:00' }]),
)

// Use a future date so these tests remain valid as time passes.
const bookingDate = new Date()
bookingDate.setUTCDate(bookingDate.getUTCDate() + 7)

function at(hour: number, minute = 0): string {
  const date = new Date(bookingDate)
  date.setUTCHours(hour, minute, 0, 0)
  return date.toISOString()
}

function createToken(userId: string) {
  return jwt.sign(
    {
      id: userId,
      email: `${tag}@example.test`,
      name: 'Test User',
      role: 'user',
    },
    JWT_SECRET,
    { expiresIn: '1h' },
  )
}

function book(
  token: string,
  roomId: string,
  startTime: string,
  endTime: string,
) {
  return request(app)
    .post('/api/reservations')
    .set('Authorization', `Bearer ${token}`)
    .send({ roomId, startTime, endTime })
}

async function createRoom(name: string): Promise<string> {
  return insertTestRoom({
    tag,
    name: `${tag}-${name}`,
    availabilityHours: OPENING_HOURS,
  })
}

async function countReservations(roomId: string): Promise<number> {
  const result = await pool.query<{ count: string }>(
    'SELECT COUNT(*) AS count FROM reservations WHERE room_id = $1',
    [roomId],
  )

  return Number(result.rows[0].count)
}

describe('POST /api/reservations booking conflicts', {
  skip: !databaseReachable,
}, () => {
  let firstUserId: string
  let firstToken: string
  let secondToken: string

  before(async () => {
    await cleanUpTestData(tag)

    firstUserId = await insertTestUser(tag, '-first')
    const secondUserId = await insertTestUser(tag, '-second')

    firstToken = createToken(firstUserId)
    secondToken = createToken(secondUserId)
  })

  after(async () => {
    await cleanUpTestData(tag)
    await pool.end()
  })

  it('rejects a partially overlapping reservation', async () => {
    const roomId = await createRoom('partial')

    await insertTestReservation({
      userId: firstUserId,
      roomId,
      startUtc: at(15),
      endUtc: at(16),
    })

    const response = await book(
      secondToken,
      roomId,
      at(15, 30),
      at(16, 30),
    )

    assert.equal(response.status, 409)
    assert.match(response.body.message, /already booked/i)
    assert.ok(response.body.errors.startTime)
    assert.equal(await countReservations(roomId), 1)
  })

  it('rejects an identical reservation window', async () => {
    const roomId = await createRoom('identical')

    await insertTestReservation({
      userId: firstUserId,
      roomId,
      startUtc: at(15),
      endUtc: at(16),
    })

    const response = await book(
      secondToken,
      roomId,
      at(15),
      at(16),
    )

    assert.equal(response.status, 409)
    assert.equal(await countReservations(roomId), 1)
  })

  it('rejects a booking that surrounds an existing reservation', async () => {
    const roomId = await createRoom('surrounding')

    await insertTestReservation({
      userId: firstUserId,
      roomId,
      startUtc: at(15),
      endUtc: at(16),
    })

    const response = await book(
      secondToken,
      roomId,
      at(14, 30),
      at(16, 30),
    )

    assert.equal(response.status, 409)
    assert.equal(await countReservations(roomId), 1)
  })

  it('allows back-to-back reservations', async () => {
    const roomId = await createRoom('back-to-back')

    await insertTestReservation({
      userId: firstUserId,
      roomId,
      startUtc: at(15),
      endUtc: at(16),
    })

    const response = await book(
      secondToken,
      roomId,
      at(16),
      at(17),
    )

    assert.equal(response.status, 201)
    assert.equal(response.body.reservation.roomId, roomId)
    assert.equal(await countReservations(roomId), 2)
  })

  it('allows a new booking after the previous one is cancelled', async () => {
    const roomId = await createRoom('cancelled')

    const reservationId = await insertTestReservation({
      userId: firstUserId,
      roomId,
      startUtc: at(15),
      endUtc: at(16),
    })

    await pool.query(
      "UPDATE reservations SET status = 'cancelled' WHERE id = $1",
      [reservationId],
    )

    const response = await book(
      secondToken,
      roomId,
      at(15),
      at(16),
    )

    assert.equal(response.status, 201)
    assert.equal(await countReservations(roomId), 2)
  })

  it('allows only one of two simultaneous conflicting bookings', async () => {
    const roomId = await createRoom('concurrent')

    const [first, second] = await Promise.all([
      book(firstToken, roomId, at(15), at(16)),
      book(secondToken, roomId, at(15), at(16)),
    ])

    const statuses = [first.status, second.status].sort()

    assert.deepEqual(statuses, [201, 409])
    assert.equal(await countReservations(roomId), 1)

    const conflict = first.status === 409 ? first : second
    assert.match(conflict.body.message, /already booked/i)
  })
})

if (!databaseReachable) {
  await pool.end()
}

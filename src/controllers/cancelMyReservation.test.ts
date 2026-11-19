import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
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
const tag = testTag('user-cancel')

const FUTURE_START = '2090-01-01T15:00:00.000Z'
const FUTURE_END = '2090-01-01T16:00:00.000Z'

const PAST_START = '2020-01-01T15:00:00.000Z'
const PAST_END = '2020-01-01T16:00:00.000Z'

describe(
  'POST /api/reservations/me/:reservationId/cancel',
  { skip: !databaseReachable },
  () => {
    let ownerId: string
    let otherUserId: string
    let roomId: string
    let ownerToken: string
    let otherUserToken: string

    before(async () => {
      await cleanUpTestData(tag)

      ownerId = await insertTestUser(tag, '-owner')
      otherUserId = await insertTestUser(tag, '-other')

      roomId = await insertTestRoom({
        tag,
        name: `${tag}-room`,
      })

      ownerToken = signTestToken({
        id: ownerId,
        role: 'user',
      })

      otherUserToken = signTestToken({
        id: otherUserId,
        role: 'user',
      })
    })

    beforeEach(async () => {
      await pool.query(
        `DELETE FROM reservations
          WHERE room_id IN (
            SELECT id FROM rooms WHERE location = $1
          )`,
        [tag],
      )
    })

    after(async () => {
      await cleanUpTestData(tag)
      await pool.end()
    })

    function cancel(reservationId: string, token?: string) {
      const pending = request(app).post(
        `/api/reservations/me/${reservationId}/cancel`,
      )

      return token
        ? pending.set('authorization', `Bearer ${token}`)
        : pending
    }

    async function createUpcomingReservation() {
      return insertTestReservation({
        userId: ownerId,
        roomId,
        startUtc: FUTURE_START,
        endUtc: FUTURE_END,
      })
    }

    async function statusOf(reservationId: string) {
      const result = await pool.query<{ status: string }>(
        'SELECT status FROM reservations WHERE id = $1',
        [reservationId],
      )

      return result.rows[0]?.status
    }

    it('rejects unauthenticated requests', async () => {
      const reservationId = await createUpcomingReservation()

      const response = await cancel(reservationId)

      assert.equal(response.status, 401)
      assert.equal(await statusOf(reservationId), 'active')
    })

    it('allows a user to cancel their own upcoming reservation', async () => {
      const reservationId = await createUpcomingReservation()

      const response = await cancel(reservationId, ownerToken)

      assert.equal(response.status, 200)
      assert.equal(response.body.reservation.id, reservationId)
      assert.equal(response.body.reservation.status, 'cancelled')

      assert.equal(await statusOf(reservationId), 'cancelled')
    })

    it('prevents cancelling another users reservation', async () => {
      const reservationId = await createUpcomingReservation()

      const response = await cancel(reservationId, otherUserToken)

      assert.equal(response.status, 404)

      assert.deepEqual(response.body, {
        message: 'That reservation could not be found.',
      })

      assert.equal(await statusOf(reservationId), 'active')
    })

    it('rejects an already cancelled reservation', async () => {
      const reservationId = await createUpcomingReservation()

      const firstResponse = await cancel(reservationId, ownerToken)
      assert.equal(firstResponse.status, 200)

      const secondResponse = await cancel(reservationId, ownerToken)

      assert.equal(secondResponse.status, 409)
      assert.equal(await statusOf(reservationId), 'cancelled')
    })

    it('rejects a reservation that has already started', async () => {
      const reservationId = await insertTestReservation({
        userId: ownerId,
        roomId,
        startUtc: PAST_START,
        endUtc: PAST_END,
      })

      const response = await cancel(reservationId, ownerToken)

      assert.equal(response.status, 409)
      assert.equal(await statusOf(reservationId), 'active')
    })

    it('returns 404 for a malformed reservation ID', async () => {
      const response = await cancel('invalid-id', ownerToken)

      assert.equal(response.status, 404)
    })

    it('preserves the cancelled record and frees the time slot', async () => {
      const reservationId = await createUpcomingReservation()

      const response = await cancel(reservationId, ownerToken)

      assert.equal(response.status, 200)
      assert.equal(await statusOf(reservationId), 'cancelled')

      // Another user should now be able to reserve the same time slot.
      const newReservationId = await insertTestReservation({
        userId: otherUserId,
        roomId,
        startUtc: FUTURE_START,
        endUtc: FUTURE_END,
      })

      assert.ok(newReservationId)
      assert.notEqual(newReservationId, reservationId)

      assert.equal(await statusOf(newReservationId), 'active')

      // The original cancelled reservation must still exist.
      assert.equal(await statusOf(reservationId), 'cancelled')
    })
  },
)
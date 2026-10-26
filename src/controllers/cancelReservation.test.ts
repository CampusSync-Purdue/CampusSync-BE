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
const tag = testTag('admin-cancel')

const FUTURE_START = '2090-01-01T15:00:00.000Z'
const FUTURE_END = '2090-01-01T16:00:00.000Z'
const PAST_START = '2020-01-01T15:00:00.000Z'
const PAST_END = '2020-01-01T16:00:00.000Z'

describe(
  'POST /api/reservations/:reservationId/cancel',
  { skip: !databaseReachable },
  () => {
    let ownerId: string
    let roomId: string
    let adminToken: string
    let userToken: string

    before(async () => {
      await cleanUpTestData(tag)

      ownerId = await insertTestUser(tag, '-owner')
      const adminId = await insertTestUser(tag, '-admin')

      roomId = await insertTestRoom({ tag, name: `${tag}-room` })
      adminToken = signTestToken({ id: adminId, role: 'admin' })
      userToken = signTestToken({ id: ownerId, role: 'user' })
    })

    beforeEach(async () => {
      // Each case starts from a clean set of reservations, so the exclusion
      // constraint cannot reject a fixture because of a previous case.
      await pool.query(
        `DELETE FROM reservations
          WHERE room_id IN (SELECT id FROM rooms WHERE location = $1)`,
        [tag],
      )
    })

    after(async () => {
      await cleanUpTestData(tag)
      await pool.end()
    })

    function cancel(reservationId: string, token?: string) {
      const pending = request(app).post(
        `/api/reservations/${reservationId}/cancel`,
      )

      return token ? pending.set('authorization', `Bearer ${token}`) : pending
    }

    async function anUpcomingReservation() {
      return insertTestReservation({
        userId: ownerId,
        roomId,
        startUtc: FUTURE_START,
        endUtc: FUTURE_END,
      })
    }

    async function statusOf(reservationId: string) {
      const stored = await pool.query<{ status: string }>(
        'SELECT status FROM reservations WHERE id = $1',
        [reservationId],
      )

      return stored.rows[0]?.status
    }

    describe('authorization', () => {
      it('rejects an unauthenticated request', async () => {
        const id = await anUpcomingReservation()
        const response = await cancel(id)

        assert.equal(response.status, 401)
        assert.equal(await statusOf(id), 'active')
      })

      it('rejects a regular user, including the booking owner', async () => {
        const id = await anUpcomingReservation()
        const response = await cancel(id, userToken)

        assert.equal(response.status, 403)
        assert.equal(
          await statusOf(id),
          'active',
          'a refused request must not change the reservation',
        )
      })

      it('allows an administrator', async () => {
        const id = await anUpcomingReservation()
        const response = await cancel(id, adminToken)

        assert.equal(response.status, 200)
      })
    })

    describe('cancelling', () => {
      it('keeps the record and marks it cancelled', async () => {
        const id = await anUpcomingReservation()

        await cancel(id, adminToken)

        assert.equal(
          await statusOf(id),
          'cancelled',
          'the row must be retained, not deleted',
        )
      })

      it('returns the reservation with its new status', async () => {
        const id = await anUpcomingReservation()
        const response = await cancel(id, adminToken)

        assert.equal(response.body.reservation.id, id)
        assert.equal(response.body.reservation.status, 'cancelled')
        assert.equal(response.body.reservation.timeframe, 'past')
      })

      it('frees the time period for a new reservation', async () => {
        const id = await anUpcomingReservation()

        await cancel(id, adminToken)

        // The exclusion constraint only covers active rows, so the same
        // window can be booked again. This would throw if it did not.
        const replacement = await insertTestReservation({
          userId: ownerId,
          roomId,
          startUtc: FUTURE_START,
          endUtc: FUTURE_END,
        })

        assert.equal(await statusOf(replacement), 'active')
      })
    })

    describe('what cannot be cancelled', () => {
      it('refuses a reservation that has already ended', async () => {
        const id = await insertTestReservation({
          userId: ownerId,
          roomId,
          startUtc: PAST_START,
          endUtc: PAST_END,
        })

        const response = await cancel(id, adminToken)

        assert.equal(response.status, 409)
        assert.equal(await statusOf(id), 'active')
      })

      it('refuses a reservation that is already cancelled', async () => {
        const id = await insertTestReservation({
          userId: ownerId,
          roomId,
          startUtc: FUTURE_START,
          endUtc: FUTURE_END,
          status: 'cancelled',
        })

        const response = await cancel(id, adminToken)

        assert.equal(response.status, 409)
      })

      it('answers 404 for a reservation that does not exist', async () => {
        const response = await cancel(
          '11111111-2222-3333-4444-555555555555',
          adminToken,
        )

        assert.equal(response.status, 404)
      })

      it('answers 404 for a malformed identifier', async () => {
        const response = await cancel('not-a-uuid', adminToken)

        assert.equal(response.status, 404)
      })
    })
  },
)

if (!databaseReachable) {
  await pool.end()
}

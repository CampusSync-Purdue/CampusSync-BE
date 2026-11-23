import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { validateAdminReservationQuery } from './adminReservationValidation.js'

const ROOM_ID = '11111111-2222-3333-4444-555555555555'

describe('validateAdminReservationQuery', () => {
  it('defaults to newest first with no filters', () => {
    assert.deepEqual(validateAdminReservationQuery({}), {
      valid: true,
      value: { sort: 'date', order: 'desc' },
    })
  })

  it('accepts every filter and sort option together', () => {
    assert.deepEqual(
      validateAdminReservationQuery({
        date: '2026-10-21',
        roomId: ROOM_ID.toUpperCase(),
        status: 'completed',
        sort: 'room',
        order: 'asc',
      }),
      {
        valid: true,
        value: {
          date: '2026-10-21',
          roomId: ROOM_ID,
          status: 'completed',
          sort: 'room',
          order: 'asc',
        },
      },
    )
  })

  it('treats blank values as absent', () => {
    const result = validateAdminReservationQuery({
      date: '',
      roomId: '  ',
      status: '',
      sort: '',
      order: '',
    })
    assert.deepEqual(result, { valid: true, value: { sort: 'date', order: 'desc' } })
  })

  it('rejects a malformed or impossible date', () => {
    for (const date of ['10/21/2026', '2026-1-1', '2026-02-30']) {
      const result = validateAdminReservationQuery({ date })
      assert.equal(result.valid, false, date)
      assert.ok(!result.valid && result.errors.date)
    }
  })

  it('rejects a room id that is not a UUID', () => {
    const result = validateAdminReservationQuery({ roomId: 'room-1' })
    assert.ok(!result.valid && result.errors.roomId)
  })

  it('rejects an unknown status, sort field, or order', () => {
    const result = validateAdminReservationQuery({
      status: 'pending',
      sort: 'user_id; DROP TABLE reservations',
      order: 'sideways',
    })
    assert.equal(result.valid, false)
    assert.ok(!result.valid && result.errors.status)
    assert.ok(!result.valid && result.errors.sort)
    assert.ok(!result.valid && result.errors.order)
  })

  it('rejects a repeated parameter', () => {
    const result = validateAdminReservationQuery({ status: ['active', 'cancelled'] })
    assert.ok(!result.valid && result.errors.status)
  })
})

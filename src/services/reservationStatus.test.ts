import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  deriveReservationStatus,
  deriveReservationTimeframe,
  isCancellable,
} from './reservationStatus.js'

const NOW = new Date('2026-10-21T18:00:00.000Z')

const ENDED = '2026-10-21T17:00:00.000Z'
const ENDS_LATER = '2026-10-21T19:00:00.000Z'

describe('reservation status derivation', () => {
  it('keeps an active reservation active while its end time is in the future', () => {
    assert.equal(deriveReservationStatus('active', ENDS_LATER, NOW), 'active')
  })

  it('reports a past active reservation as completed', () => {
    assert.equal(deriveReservationStatus('active', ENDED, NOW), 'completed')
  })

  it('treats a reservation ending exactly now as completed', () => {
    // Reservations use half-open ranges, so the end instant is not included.
    assert.equal(
      deriveReservationStatus('active', '2026-10-21T18:00:00.000Z', NOW),
      'completed',
    )
  })

  it('keeps a cancelled reservation cancelled after its end time passes', () => {
    assert.equal(deriveReservationStatus('cancelled', ENDED, NOW), 'cancelled')
  })

  it('keeps a cancelled reservation cancelled before its end time', () => {
    assert.equal(deriveReservationStatus('cancelled', ENDS_LATER, NOW), 'cancelled')
  })

  it('leaves an already-stored completed status untouched', () => {
    assert.equal(deriveReservationStatus('completed', ENDED, NOW), 'completed')
  })

  it('accepts an end time expressed with a campus offset', () => {
    // 13:00-04:00 is 17:00Z, an hour before NOW.
    assert.equal(
      deriveReservationStatus('active', '2026-10-21T13:00:00-04:00', NOW),
      'completed',
    )
  })

  it('rejects an end time with no explicit offset', () => {
    assert.throws(() => deriveReservationStatus('active', '2026-10-21T17:00:00', NOW))
  })
})

describe('reservation timeframe', () => {
  it('places a future active reservation in the upcoming section', () => {
    assert.equal(deriveReservationTimeframe('active', ENDS_LATER, NOW), 'upcoming')
  })

  it('places a completed reservation in history', () => {
    assert.equal(deriveReservationTimeframe('active', ENDED, NOW), 'past')
  })

  it('places a cancelled reservation in history even when it has not ended', () => {
    assert.equal(deriveReservationTimeframe('cancelled', ENDS_LATER, NOW), 'past')
  })
})

describe('isCancellable', () => {
  it('allows cancelling an upcoming active reservation', () => {
    assert.equal(isCancellable({ status: 'active', endTime: ENDS_LATER }, NOW), true)
  })

  it('refuses to cancel a reservation that has already ended', () => {
    assert.equal(isCancellable({ status: 'active', endTime: ENDED }, NOW), false)
  })

  it('refuses to cancel an already-cancelled reservation', () => {
    assert.equal(isCancellable({ status: 'cancelled', endTime: ENDS_LATER }, NOW), false)
  })
})

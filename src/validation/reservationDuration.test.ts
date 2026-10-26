import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { validateReservationDuration } from './reservationDuration.js'
import {
  DEFAULT_MAX_RESERVATION_DURATION_MINUTES,
  describeMaxDuration,
} from '../config/reservationRules.js'

describe('validateReservationDuration', () => {
  it('accepts a window shorter than the limit', () => {
    const result = validateReservationDuration(
      '2026-10-21T18:00:00.000Z',
      '2026-10-21T20:00:00.000Z',
      180,
    )

    assert.equal(result.valid, true)
    assert.equal(result.minutes, 120)
  })

  it('accepts a window exactly at the limit', () => {
    const result = validateReservationDuration(
      '2026-10-21T18:00:00.000Z',
      '2026-10-21T21:00:00.000Z',
      180,
    )

    assert.equal(result.valid, true)
  })

  it('rejects a window one minute over the limit', () => {
    const result = validateReservationDuration(
      '2026-10-21T18:00:00.000Z',
      '2026-10-21T21:01:00.000Z',
      180,
    )

    assert.equal(result.valid, false)
    assert.equal(result.minutes, 181)
  })

  it('names the limit in the rejection message', () => {
    const result = validateReservationDuration(
      '2026-10-21T18:00:00.000Z',
      '2026-10-22T18:00:00.000Z',
      180,
    )

    assert.equal(result.valid, false)

    if (!result.valid) {
      assert.match(result.message, /3 hours/)
    }
  })

  it('measures elapsed time rather than the wall clock across spring forward', () => {
    // 01:30 to 03:30 campus-local on the spring-forward date looks like two
    // hours on the clock but only one hour elapses.
    const result = validateReservationDuration(
      '2026-03-08T06:30:00.000Z',
      '2026-03-08T07:30:00.000Z',
      90,
    )

    assert.equal(result.valid, true)
    assert.equal(result.minutes, 60)
  })

  it('measures elapsed time rather than the wall clock across fall back', () => {
    // 01:00 to 02:00 campus-local on the fall-back date reads as one hour on
    // the clock, but two hours actually elapse.
    const result = validateReservationDuration(
      '2026-11-01T05:00:00.000Z',
      '2026-11-01T07:00:00.000Z',
      90,
    )

    assert.equal(result.valid, false)
    assert.equal(result.minutes, 120)
  })

  it('defaults to the configured limit when none is passed', () => {
    const overLimitEnd = new Date(
      Date.parse('2026-10-21T18:00:00.000Z') +
        (DEFAULT_MAX_RESERVATION_DURATION_MINUTES + 1) * 60_000,
    ).toISOString()

    const result = validateReservationDuration(
      '2026-10-21T18:00:00.000Z',
      overLimitEnd,
    )

    assert.equal(result.valid, false)
  })
})

describe('describeMaxDuration', () => {
  it('names a whole number of hours', () => {
    assert.equal(describeMaxDuration(180), '3 hours')
    assert.equal(describeMaxDuration(60), '1 hour')
  })

  it('falls back to minutes when hours do not divide evenly', () => {
    assert.equal(describeMaxDuration(90), '90 minutes')
    assert.equal(describeMaxDuration(1), '1 minute')
  })
})

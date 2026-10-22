import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { validateAvailabilityQuery } from './availabilityValidation.js'

function errorsFor(query: unknown) {
  const result = validateAvailabilityQuery(query)

  assert.equal(result.valid, false, 'expected the query to be rejected')

  return result.valid === false ? result.errors : {}
}

const VALID = { date: '2026-10-21', startTime: '14:00', endTime: '16:00' }

describe('validateAvailabilityQuery', () => {
  it('accepts a well-formed query', () => {
    const result = validateAvailabilityQuery(VALID)

    assert.equal(result.valid, true)
  })

  it('converts the campus-local window to UTC instants', () => {
    const result = validateAvailabilityQuery(VALID)

    assert.equal(result.valid, true)

    if (result.valid) {
      // October is EDT, UTC-04:00, so 14:00 local is 18:00Z.
      assert.equal(result.value.startUtc, '2026-10-21T18:00:00.000Z')
      assert.equal(result.value.endUtc, '2026-10-21T20:00:00.000Z')
    }
  })

  it('keeps the campus-local values the caller supplied', () => {
    const result = validateAvailabilityQuery(VALID)

    if (result.valid) {
      assert.equal(result.value.date, '2026-10-21')
      assert.equal(result.value.startTime, '14:00')
      assert.equal(result.value.endTime, '16:00')
    }
  })

  it('trims surrounding whitespace', () => {
    const result = validateAvailabilityQuery({
      date: ' 2026-10-21 ',
      startTime: ' 14:00 ',
      endTime: ' 16:00 ',
    })

    assert.equal(result.valid, true)
  })

  it('requires every field', () => {
    const errors = errorsFor({})

    assert.ok(errors.date)
    assert.ok(errors.startTime)
    assert.ok(errors.endTime)
  })

  it('rejects a malformed date', () => {
    assert.ok(errorsFor({ ...VALID, date: '21-10-2026' }).date)
  })

  it('rejects a date that matches the pattern but does not exist', () => {
    assert.ok(errorsFor({ ...VALID, date: '2026-02-30' }).date)
  })

  it('rejects a malformed time', () => {
    assert.ok(errorsFor({ ...VALID, startTime: '2pm' }).startTime)
  })

  it('rejects an hour outside the 24-hour clock', () => {
    assert.ok(errorsFor({ ...VALID, startTime: '24:00' }).startTime)
    assert.ok(errorsFor({ ...VALID, endTime: '25:00' }).endTime)
  })

  it('requires the end time to be after the start time', () => {
    assert.ok(errorsFor({ ...VALID, startTime: '16:00', endTime: '14:00' }).endTime)
  })

  it('rejects an end time equal to the start time', () => {
    assert.ok(errorsFor({ ...VALID, startTime: '14:00', endTime: '14:00' }).endTime)
  })

  it('rejects a local time that does not exist because clocks moved forward', () => {
    // 2026-03-08 02:30 is skipped by the spring-forward transition.
    assert.ok(
      errorsFor({ date: '2026-03-08', startTime: '02:30', endTime: '03:30' }).startTime,
    )
  })

  it('rejects an ambiguous local time that occurs twice when clocks move back', () => {
    // 2026-11-01 01:30 happens twice during the fall-back transition.
    assert.ok(
      errorsFor({ date: '2026-11-01', startTime: '01:30', endTime: '01:45' }).startTime,
    )
  })
})

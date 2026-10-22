import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  CAMPUS_TIME_ZONE,
  toUtc,
  toCampusTime,
  campusLocalToUtc,
  elapsedMinutes,
} from './dateTime.js'

describe('CampusSync date/time conventions', () => {
  it('uses the Indianapolis campus time zone', () => {
    assert.equal(CAMPUS_TIME_ZONE, 'America/Indiana/Indianapolis')
  })

  it('converts an offset timestamp to UTC', () => {
    assert.equal(
      toUtc('2026-10-21T14:00:00-04:00'),
      '2026-10-21T18:00:00.000Z',
    )
  })

  it('rejects timestamps without offsets', () => {
    assert.throws(() => toUtc('2026-10-21T14:00:00'))
  })

  it('rejects invalid timestamps', () => {
    assert.throws(() => toUtc('2026-02-30T14:00:00Z'))
  })

  it('displays UTC timestamps in campus local time', () => {
    const local = toCampusTime('2026-10-21T18:00:00Z')

    assert.equal(local.hour, 14)
    assert.equal(local.offset, -240)
  })

  it('converts campus local time to UTC', () => {
    assert.equal(
      campusLocalToUtc('2026-10-21T14:00:00'),
      '2026-10-21T18:00:00.000Z',
    )
  })

  it('rejects nonexistent spring-forward times', () => {
    assert.throws(
      () => campusLocalToUtc('2026-03-08T02:30:00'),
      /Nonexistent/,
    )
  })

  it('rejects ambiguous fall-back times', () => {
    assert.throws(
      () => campusLocalToUtc('2026-11-01T01:30:00'),
      /Ambiguous/,
    )
  })

  it('calculates elapsed minutes across spring DST', () => {
    assert.equal(
      elapsedMinutes(
        '2026-03-08T01:30:00-05:00',
        '2026-03-08T03:30:00-04:00',
      ),
      60,
    )
  })

  it('calculates elapsed minutes across fall DST', () => {
    assert.equal(
      elapsedMinutes(
        '2026-11-01T01:30:00-04:00',
        '2026-11-01T01:30:00-05:00',
      ),
      60,
    )
  })
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isOvernight, isWithinOperatingHours, weekdayOf } from './operatingHours.js'
import type { OperatingHours } from '../types/room.js'

const WEEKDAY_HOURS: OperatingHours = {
  // 2026-10-21 is a Wednesday.
  wednesday: { open: '08:00', close: '22:00' },
}

const OVERNIGHT_HOURS: OperatingHours = {
  wednesday: { open: '20:00', close: '02:00' },
}

const WEDNESDAY = '2026-10-21'
const THURSDAY = '2026-10-22'

describe('weekdayOf', () => {
  it('maps a date to its campus-local weekday', () => {
    assert.equal(weekdayOf('2026-10-21'), 'wednesday')
    assert.equal(weekdayOf('2026-10-22'), 'thursday')
    assert.equal(weekdayOf('2026-10-25'), 'sunday')
  })
})

describe('isOvernight', () => {
  it('treats a close after open as a normal day', () => {
    assert.equal(isOvernight({ open: '08:00', close: '22:00' }), false)
  })

  it('treats a close before open as running past midnight', () => {
    assert.equal(isOvernight({ open: '20:00', close: '02:00' }), true)
  })
})

describe('isWithinOperatingHours', () => {
  it('accepts a window inside the published hours', () => {
    assert.equal(
      isWithinOperatingHours(WEEKDAY_HOURS, WEDNESDAY, '14:00', '16:00'),
      true,
    )
  })

  it('accepts a window exactly matching the published hours', () => {
    assert.equal(
      isWithinOperatingHours(WEEKDAY_HOURS, WEDNESDAY, '08:00', '22:00'),
      true,
    )
  })

  it('rejects a window starting before the room opens', () => {
    assert.equal(
      isWithinOperatingHours(WEEKDAY_HOURS, WEDNESDAY, '07:00', '09:00'),
      false,
    )
  })

  it('rejects a window ending after the room closes', () => {
    assert.equal(
      isWithinOperatingHours(WEEKDAY_HOURS, WEDNESDAY, '21:00', '23:00'),
      false,
    )
  })

  it('rejects a day with no published hours', () => {
    assert.equal(
      isWithinOperatingHours(WEEKDAY_HOURS, THURSDAY, '14:00', '16:00'),
      false,
    )
  })

  it('treats empty operating hours as closed rather than open all day', () => {
    assert.equal(isWithinOperatingHours({}, WEDNESDAY, '14:00', '16:00'), false)
  })

  describe('overnight hours', () => {
    it('accepts a window in the evening segment', () => {
      assert.equal(
        isWithinOperatingHours(OVERNIGHT_HOURS, WEDNESDAY, '21:00', '23:00'),
        true,
      )
    })

    it('accepts a window in the early-morning segment', () => {
      assert.equal(
        isWithinOperatingHours(OVERNIGHT_HOURS, WEDNESDAY, '00:30', '01:30'),
        true,
      )
    })

    it('rejects a window while the room is closed during the day', () => {
      assert.equal(
        isWithinOperatingHours(OVERNIGHT_HOURS, WEDNESDAY, '14:00', '16:00'),
        false,
      )
    })

    it('rejects a window straddling the closed middle of the day', () => {
      assert.equal(
        isWithinOperatingHours(OVERNIGHT_HOURS, WEDNESDAY, '01:00', '23:00'),
        false,
      )
    })

    it('rejects a window ending after the room closes in the morning', () => {
      assert.equal(
        isWithinOperatingHours(OVERNIGHT_HOURS, WEDNESDAY, '01:00', '03:00'),
        false,
      )
    })
  })
})

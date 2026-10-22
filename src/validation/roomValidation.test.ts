import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { validateNewRoom } from './roomValidation.js'

const VALID = {
  name: 'Study Room 101',
  location: 'Library',
  capacity: 8,
  description: 'A quiet room.',
  amenities: ['WiFi', 'Whiteboard'],
  availabilityHours: { monday: { open: '08:00', close: '22:00' } },
}

function errorsFor(body: unknown) {
  const result = validateNewRoom(body)

  assert.equal(result.valid, false, 'expected the room to be rejected')

  return result.valid === false ? result.errors : {}
}

describe('validateNewRoom', () => {
  it('accepts a well-formed room', () => {
    const result = validateNewRoom(VALID)

    assert.equal(result.valid, true)
  })

  it('trims text fields', () => {
    const result = validateNewRoom({ ...VALID, name: '  Study Room 101  ' })

    if (result.valid) {
      assert.equal(result.value.name, 'Study Room 101')
    }
  })

  it('requires a name', () => {
    assert.ok(errorsFor({ ...VALID, name: '   ' }).name)
  })

  it('requires a location', () => {
    assert.ok(errorsFor({ ...VALID, location: '' }).location)
  })

  it('requires a capacity', () => {
    assert.ok(errorsFor({ ...VALID, capacity: undefined }).capacity)
  })

  it('rejects a capacity below 1', () => {
    assert.ok(errorsFor({ ...VALID, capacity: 0 }).capacity)
  })

  it('rejects a fractional capacity', () => {
    assert.ok(errorsFor({ ...VALID, capacity: 4.5 }).capacity)
  })

  it('accepts a capacity submitted as a numeric string', () => {
    const result = validateNewRoom({ ...VALID, capacity: '12' })

    assert.equal(result.valid, true)

    if (result.valid) {
      assert.equal(result.value.capacity, 12)
    }
  })

  it('rejects a capacity that is not a number', () => {
    assert.ok(errorsFor({ ...VALID, capacity: 'eight' }).capacity)
  })

  it('requires operating hours', () => {
    assert.ok(errorsFor({ ...VALID, availabilityHours: undefined }).availabilityHours)
  })

  it('rejects empty operating hours, which would make the room unbookable', () => {
    assert.ok(errorsFor({ ...VALID, availabilityHours: {} }).availabilityHours)
  })

  it('rejects a key that is not a day of the week', () => {
    assert.ok(
      errorsFor({
        ...VALID,
        availabilityHours: { someday: { open: '08:00', close: '22:00' } },
      }).availabilityHours,
    )
  })

  it('rejects a malformed opening time', () => {
    assert.ok(
      errorsFor({
        ...VALID,
        availabilityHours: { monday: { open: '8am', close: '22:00' } },
      }).availabilityHours,
    )
  })

  it('rejects a day missing its closing time', () => {
    assert.ok(
      errorsFor({
        ...VALID,
        availabilityHours: { monday: { open: '08:00' } },
      }).availabilityHours,
    )
  })

  it('accepts overnight hours', () => {
    const result = validateNewRoom({
      ...VALID,
      availabilityHours: { friday: { open: '20:00', close: '02:00' } },
    })

    assert.equal(result.valid, true)
  })

  it('accepts hours for several days', () => {
    const result = validateNewRoom({
      ...VALID,
      availabilityHours: {
        monday: { open: '08:00', close: '22:00' },
        tuesday: { open: '09:00', close: '17:00' },
      },
    })

    assert.equal(result.valid, true)
  })

  it('defaults amenities to an empty list', () => {
    const result = validateNewRoom({ ...VALID, amenities: undefined })

    if (result.valid) {
      assert.deepEqual(result.value.amenities, [])
    }
  })

  it('rejects amenities that are not a list', () => {
    assert.ok(errorsFor({ ...VALID, amenities: 'WiFi' }).amenities)
  })

  it('rejects a blank amenity', () => {
    assert.ok(errorsFor({ ...VALID, amenities: ['WiFi', '  '] }).amenities)
  })

  it('defaults a missing description to an empty string', () => {
    const result = validateNewRoom({ ...VALID, description: undefined })

    if (result.valid) {
      assert.equal(result.value.description, '')
    }
  })

  it('reports every invalid field at once', () => {
    const errors = errorsFor({})

    assert.ok(errors.name)
    assert.ok(errors.location)
    assert.ok(errors.capacity)
    assert.ok(errors.availabilityHours)
  })
})

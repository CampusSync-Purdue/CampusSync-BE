import assert from 'node:assert/strict'
import { after, afterEach, before, beforeEach, describe, it } from 'node:test'
import { eq } from 'drizzle-orm'
import { getPgConstraint, getPgErrorCode, PG_EXCLUSION_VIOLATION } from './errors.js'
import { db } from './index.js'
import { reservations, rooms, users } from './schema.js'
import {
  closeTestDatabase,
  resetTestDatabase,
  setupTestDatabase,
} from '../test/database.js'

let userId = ''
let roomId = ''

before(async () => {
  await setupTestDatabase()
  await resetTestDatabase()
})

after(async () => {
  await closeTestDatabase()
})

beforeEach(async () => {
  const [user] = await db
    .insert(users)
    .values({ name: 'Schema Test', email: 'schema@campussync.edu', passwordHash: 'x' })
    .returning()
  const [room] = await db
    .insert(rooms)
    .values({ name: 'Room 1', location: 'Library', capacity: 4 })
    .returning()

  userId = user.id
  roomId = room.id
})

afterEach(async () => {
  await resetTestDatabase()
})

function reserve(start: string, end: string, status: 'active' | 'cancelled' = 'active') {
  return db
    .insert(reservations)
    .values({ userId, roomId, startTime: new Date(start), endTime: new Date(end), status })
    .returning()
}

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }

  assert.fail('expected the query to fail')
}

describe('reservations schema', () => {
  it('defaults new reservations to active', async () => {
    const [reservation] = await reserve('2030-01-01T15:00:00Z', '2030-01-01T16:00:00Z')

    assert.equal(reservation.status, 'active')
  })

  it('rejects overlapping active reservations for the same room', async () => {
    await reserve('2030-01-01T15:00:00Z', '2030-01-01T16:00:00Z')

    const error = await captureError(reserve('2030-01-01T15:30:00Z', '2030-01-01T16:30:00Z'))

    assert.equal(getPgErrorCode(error), PG_EXCLUSION_VIOLATION)
    assert.equal(getPgConstraint(error), 'reservations_no_overlap')
  })

  it('allows back-to-back reservations', async () => {
    await reserve('2030-01-01T15:00:00Z', '2030-01-01T16:00:00Z')

    const [second] = await reserve('2030-01-01T16:00:00Z', '2030-01-01T17:00:00Z')

    assert.ok(second.id)
  })

  it('does not let a cancelled reservation block the slot', async () => {
    await reserve('2030-01-01T15:00:00Z', '2030-01-01T16:00:00Z', 'cancelled')

    const [active] = await reserve('2030-01-01T15:00:00Z', '2030-01-01T16:00:00Z')

    assert.equal(active.status, 'active')
  })

  it('rejects an end time that is not after the start time', async () => {
    const error = await captureError(reserve('2030-01-01T16:00:00Z', '2030-01-01T16:00:00Z'))

    assert.equal(getPgConstraint(error), 'reservations_end_after_start')
  })

  it('enforces case-insensitive email uniqueness', async () => {
    const error = await captureError(
      db.insert(users).values({ name: 'Dup', email: 'SCHEMA@campussync.edu', passwordHash: 'x' }),
    )

    assert.equal(getPgConstraint(error), 'users_email_lower_unique')

    const rows = await db.select().from(users).where(eq(users.id, userId))
    assert.equal(rows.length, 1)
  })
})

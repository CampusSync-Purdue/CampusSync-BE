import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import request from 'supertest'
import app from '../app.js'
import { pool } from '../config/database.js'
import {
  cleanUpTestData,
  insertTestReservation,
  insertTestRoom,
  insertTestUser,
  isDatabaseReachable,
  testTag,
} from '../test/database.js'

const databaseReachable = await isDatabaseReachable()
const tag = testTag('availability')

// 2026-10-21 is a Wednesday. October is EDT (UTC-04:00), so campus-local
// 14:00 is 18:00Z.
const DATE = '2026-10-21'
const WEDNESDAY_HOURS = { wednesday: { open: '08:00', close: '22:00' } }

function search(params: Record<string, string>) {
  return request(app).get('/api/rooms/availability').query(params)
}

describe('GET /api/rooms/availability', { skip: !databaseReachable }, () => {
  let userId: string

  before(async () => {
    await cleanUpTestData(tag)
    userId = await insertTestUser(tag)
  })

  after(async () => {
    await cleanUpTestData(tag)
    await pool.end()
  })

  it('returns a free room inside its operating hours', async () => {
    const roomName = `${tag}-free`
    await insertTestRoom({
      tag,
      name: roomName,
      availabilityHours: WEDNESDAY_HOURS,
    })

    const response = await search({ date: DATE, startTime: '14:00', endTime: '16:00' })

    assert.equal(response.status, 200)
    assert.ok(
      response.body.rooms.some((room: { name: string }) => room.name === roomName),
      'expected the free room to be offered',
    )
  })

  it('echoes the window that was searched', async () => {
    const response = await search({ date: DATE, startTime: '14:00', endTime: '16:00' })

    assert.equal(response.body.date, DATE)
    assert.equal(response.body.startTime, '14:00')
    assert.equal(response.body.endTime, '16:00')
  })

  it('excludes a room whose active reservation overlaps the window', async () => {
    const roomName = `${tag}-booked`
    const roomId = await insertTestRoom({
      tag,
      name: roomName,
      availabilityHours: WEDNESDAY_HOURS,
    })

    await insertTestReservation({
      userId,
      roomId,
      startUtc: '2026-10-21T18:30:00.000Z',
      endUtc: '2026-10-21T19:30:00.000Z',
    })

    const response = await search({ date: DATE, startTime: '14:00', endTime: '16:00' })

    assert.ok(
      !response.body.rooms.some((room: { name: string }) => room.name === roomName),
      'expected the booked room to be withheld',
    )
  })

  it('offers a room whose only reservation was cancelled', async () => {
    const roomName = `${tag}-cancelled`
    const roomId = await insertTestRoom({
      tag,
      name: roomName,
      availabilityHours: WEDNESDAY_HOURS,
    })

    await insertTestReservation({
      userId,
      roomId,
      startUtc: '2026-10-21T18:30:00.000Z',
      endUtc: '2026-10-21T19:30:00.000Z',
      status: 'cancelled',
    })

    const response = await search({ date: DATE, startTime: '14:00', endTime: '16:00' })

    assert.ok(
      response.body.rooms.some((room: { name: string }) => room.name === roomName),
      'a cancelled reservation does not hold the room',
    )
  })

  it('offers a room whose reservation ends exactly when the window begins', async () => {
    const roomName = `${tag}-abutting`
    const roomId = await insertTestRoom({
      tag,
      name: roomName,
      availabilityHours: WEDNESDAY_HOURS,
    })

    // Reservations use half-open ranges, so this does not overlap 18:00Z.
    await insertTestReservation({
      userId,
      roomId,
      startUtc: '2026-10-21T17:00:00.000Z',
      endUtc: '2026-10-21T18:00:00.000Z',
    })

    const response = await search({ date: DATE, startTime: '14:00', endTime: '16:00' })

    assert.ok(
      response.body.rooms.some((room: { name: string }) => room.name === roomName),
      'a reservation ending as the window opens does not conflict',
    )
  })

  it('excludes a room when the window falls outside its operating hours', async () => {
    const roomName = `${tag}-closed`
    await insertTestRoom({
      tag,
      name: roomName,
      availabilityHours: { wednesday: { open: '08:00', close: '12:00' } },
    })

    const response = await search({ date: DATE, startTime: '14:00', endTime: '16:00' })

    assert.ok(
      !response.body.rooms.some((room: { name: string }) => room.name === roomName),
      'expected a closed room to be withheld',
    )
  })

  it('excludes a room with no published operating hours', async () => {
    const roomName = `${tag}-no-hours`
    await insertTestRoom({ tag, name: roomName, availabilityHours: {} })

    const response = await search({ date: DATE, startTime: '14:00', endTime: '16:00' })

    assert.ok(
      !response.body.rooms.some((room: { name: string }) => room.name === roomName),
      'empty operating hours mean closed, not open all day',
    )
  })

  it('excludes an inactive room', async () => {
    const roomName = `${tag}-inactive`
    await insertTestRoom({
      tag,
      name: roomName,
      isActive: false,
      availabilityHours: WEDNESDAY_HOURS,
    })

    const response = await search({ date: DATE, startTime: '14:00', endTime: '16:00' })

    assert.ok(
      !response.body.rooms.some((room: { name: string }) => room.name === roomName),
      'expected an inactive room to be withheld',
    )
  })

  it('answers 200 with an empty list when nothing matches', async () => {
    // A Sunday, which none of the seeded rooms publish hours for.
    const response = await search({ date: '2026-10-25', startTime: '14:00', endTime: '16:00' })

    assert.equal(response.status, 200)
    assert.ok(Array.isArray(response.body.rooms))
    assert.equal(
      response.body.rooms.filter((room: { location: string }) => room.location === tag).length,
      0,
    )
  })

  it('rejects a query with no date', async () => {
    const response = await search({ startTime: '14:00', endTime: '16:00' })

    assert.equal(response.status, 400)
    assert.ok(response.body.errors.date)
  })

  it('rejects a window longer than a reservation may run', async () => {
    const response = await search({ date: DATE, startTime: '09:00', endTime: '17:00' })

    assert.equal(response.status, 400)
    assert.match(response.body.errors.endTime, /longer than/)
  })

  it('rejects an end time that is not after the start time', async () => {
    const response = await search({ date: DATE, startTime: '16:00', endTime: '14:00' })

    assert.equal(response.status, 400)
    assert.ok(response.body.errors.endTime)
  })
})

// Without a database the suite above is skipped, so close the pool here to
// stop it holding the process open.
if (!databaseReachable) {
  await pool.end()
}

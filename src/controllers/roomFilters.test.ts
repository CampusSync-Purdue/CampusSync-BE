import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import request from 'supertest'
import app from '../app.js'
import { pool } from '../config/database.js'
import {
  insertTestRoom,
  isDatabaseReachable,
  testTag,
} from '../test/database.js'

const databaseReachable = await isDatabaseReachable()
const tag = testTag('room-filters')

const DATE = '2026-10-21'
const HOURS = { wednesday: { open: '08:00', close: '22:00' } }
const BASE_QUERY = { date: DATE, startTime: '14:00', endTime: '16:00' }

const roomIds: string[] = []

async function addRoom(
  name: string,
  location: string,
  capacity: number,
  amenities: string[],
) {
  const id = await insertTestRoom({
    tag,
    name: `${tag}-${name}`,
    location,
    capacity,
    amenities,
    availabilityHours: HOURS,
  })

  roomIds.push(id)
  return id
}

function search(params: Record<string, string>) {
  return request(app).get('/api/rooms/availability').query(params)
}

describe('GET /api/rooms/availability room filters (CSYNC-16)', {
  skip: !databaseReachable,
}, () => {
  before(async () => {
    await addRoom('library-study', 'Library', 8, ['WiFi', 'Whiteboard'])
    await addRoom('library-conference', 'Library', 15, ['WiFi', 'Projector', 'Whiteboard'])
    await addRoom('science-conference', 'Science Hall', 20, ['WiFi', 'Projector'])
  })

  after(async () => {
    if (roomIds.length > 0) {
      await pool.query('DELETE FROM rooms WHERE id = ANY($1::uuid[])', [roomIds])
    }
    await pool.end()
  })

  it('filters rooms by location', async () => {
    const response = await search({ ...BASE_QUERY, location: 'Library' })

    assert.equal(response.status, 200)
    const matching = response.body.rooms.filter(
      (room: { name: string }) => room.name.startsWith(tag),
    )

    assert.equal(matching.length, 2)
    assert.ok(matching.every((room: { location: string }) => room.location === 'Library'))
  })

  it('filters rooms by minimum capacity', async () => {
    const response = await search({ ...BASE_QUERY, minCapacity: '15' })

    assert.equal(response.status, 200)
    const matching = response.body.rooms.filter(
      (room: { name: string }) => room.name.startsWith(tag),
    )

    assert.equal(matching.length, 2)
    assert.ok(matching.every((room: { capacity: number }) => room.capacity >= 15))
  })

  it('requires every selected amenity', async () => {
    const response = await search({
      ...BASE_QUERY,
      amenities: 'WiFi,Whiteboard',
    })

    assert.equal(response.status, 200)
    const matching = response.body.rooms.filter(
      (room: { name: string }) => room.name.startsWith(tag),
    )

    assert.equal(matching.length, 2)
  })

  it('applies location, capacity, and amenities together', async () => {
    const response = await search({
      ...BASE_QUERY,
      location: 'Library',
      minCapacity: '10',
      amenities: 'WiFi,Projector',
    })

    assert.equal(response.status, 200)
    const matching = response.body.rooms.filter(
      (room: { name: string }) => room.name.startsWith(tag),
    )

    assert.equal(matching.length, 1)
    assert.ok(matching[0].name.endsWith('library-conference'))
  })

  it('matches location and amenities without case sensitivity', async () => {
    const response = await search({
      ...BASE_QUERY,
      location: 'library',
      amenities: 'wifi,whiteboard',
    })

    assert.equal(response.status, 200)
    const matching = response.body.rooms.filter(
      (room: { name: string }) => room.name.startsWith(tag),
    )

    assert.equal(matching.length, 2)
  })

  it('preserves the unfiltered search', async () => {
    const response = await search(BASE_QUERY)

    assert.equal(response.status, 200)
    const matching = response.body.rooms.filter(
      (room: { name: string }) => room.name.startsWith(tag),
    )

    assert.equal(matching.length, 3)
  })

  it('rejects invalid minimum capacity', async () => {
    const response = await search({
      ...BASE_QUERY,
      minCapacity: 'abc',
    })

    assert.equal(response.status, 400)
    assert.ok(response.body.errors.minCapacity)
  })

  it('returns an empty result when no rooms match', async () => {
    const response = await search({
      ...BASE_QUERY,
      location: 'Nonexistent Building',
    })

    assert.equal(response.status, 200)
    assert.ok(Array.isArray(response.body.rooms))
    assert.equal(response.body.rooms.length, 0)
  })
})

if (!databaseReachable) {
  await pool.end()
}

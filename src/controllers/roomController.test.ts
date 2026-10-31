import assert from 'node:assert/strict'
import { after, afterEach, before, describe, it } from 'node:test'
import { db } from '../db/index.js'
import { rooms } from '../db/schema.js'
import {
  closeTestDatabase,
  resetTestDatabase,
  setupTestDatabase,
} from '../test/database.js'
import { startTestServer } from '../test/server.js'

type ActiveRoomResponse = Array<{
  id: string
  name: string
  location: string
  capacity: number
  amenities: string[]
}>

let server: Awaited<ReturnType<typeof startTestServer>>

before(async () => {
  await setupTestDatabase()
  await resetTestDatabase()
  server = await startTestServer()
})

after(async () => {
  await server.close()
  await closeTestDatabase()
})

afterEach(async () => {
  await resetTestDatabase()
})

describe('GET /api/rooms', () => {
  it('returns active rooms from the database and excludes inactive rooms', async () => {
    await db.insert(rooms).values([
      {
        name: 'Active Test Room',
        location: 'Library',
        capacity: 8,
        amenities: ['WiFi'],
        isActive: true,
      },
      {
        name: 'Inactive Test Room',
        location: 'Science Hall',
        capacity: 12,
        amenities: ['Projector'],
        isActive: false,
      },
    ])

    const response = await server.request<ActiveRoomResponse>(
      'GET',
      '/api/rooms',
    )

    assert.equal(response.status, 200)
    assert.equal(response.body.length, 1)
    assert.equal(response.body[0]?.name, 'Active Test Room')
    assert.equal(response.body[0]?.location, 'Library')
    assert.equal(response.body[0]?.capacity, 8)
    assert.deepEqual(response.body[0]?.amenities, ['WiFi'])
    assert.ok(response.body[0]?.id)
  })
})
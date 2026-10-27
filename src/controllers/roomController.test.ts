import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { startTestServer } from '../test/server.js'

let server: Awaited<ReturnType<typeof startTestServer>>

before(async () => {
  server = await startTestServer()
})

after(async () => {
  await server.close()
})

describe('GET /api/rooms/:roomId', () => {
  it('returns an active room by id', async () => {
    const response = await server.request('GET', '/api/rooms/room-101')

    assert.equal(response.status, 200)
    assert.deepEqual(response.body, {
      id: 'room-101',
      name: 'Study Room 101',
      location: 'Library',
      capacity: 8,
      amenities: ['WiFi', 'Whiteboard'],
    })
  })

  it('returns 404 for an inactive room', async () => {
    const response = await server.request('GET', '/api/rooms/room-303')

    assert.equal(response.status, 404)
    assert.deepEqual(response.body, {
      message: 'Room not found.',
    })
  })

  it('returns 404 for a room that does not exist', async () => {
    const response = await server.request(
      'GET',
      '/api/rooms/does-not-exist',
    )

    assert.equal(response.status, 404)
    assert.deepEqual(response.body, {
      message: 'Room not found.',
    })
  })
})
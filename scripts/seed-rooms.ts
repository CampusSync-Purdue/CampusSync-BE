import 'dotenv/config'
import { pool } from '../src/config/database.js'
import { db } from '../src/db/index.js'
import { DEMO_ROOMS, seedRooms } from '../src/db/seedRooms.js'

try {
  await seedRooms(db)
  console.log(`Seeded ${DEMO_ROOMS.length} demo rooms.`)
} catch (error) {
  console.error('Failed to seed rooms:', error)
  process.exitCode = 1
} finally {
  await pool.end()
}

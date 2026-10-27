import 'dotenv/config'
import { pool } from '../src/config/database.js'
import { db } from '../src/db/index.js'
import { runMigrations } from '../src/db/migrate.js'

try {
  await runMigrations(db)
  console.log('Database migrations are up to date.')
} catch (error) {
  console.error('Failed to run database migrations:', error)
  process.exitCode = 1
} finally {
  await pool.end()
}

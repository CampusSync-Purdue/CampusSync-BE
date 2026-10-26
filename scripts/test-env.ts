/**
 * Preloaded by `npm test` before any test file. It points the app at the
 * dedicated test database so tests can never truncate development data.
 */
import dotenv from 'dotenv'

dotenv.config({ quiet: true })

const testDatabaseUrl = process.env.TEST_DATABASE_URL

if (!testDatabaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL must be set to run tests. Run `./dev-env postgres test-db` and add TEST_DATABASE_URL to .env (see .env.example).',
  )
}

if (testDatabaseUrl === process.env.DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL must point at a different database than DATABASE_URL.')
}

process.env.DATABASE_URL = testDatabaseUrl
process.env.JWT_SECRET ||= 'test-only-jwt-secret'
process.env.NODE_ENV = 'test'

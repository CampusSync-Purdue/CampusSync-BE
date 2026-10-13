const jwtSecret = process.env.JWT_SECRET
const databaseUrl = process.env.DATABASE_URL

if (!jwtSecret) {
  throw new Error('JWT_SECRET must be set before starting the API.')
}

if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set before starting the API.')
}

export const JWT_SECRET = jwtSecret
export const DATABASE_URL = databaseUrl
export const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173'
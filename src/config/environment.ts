const jwtSecret = process.env.JWT_SECRET
const databaseUrl = process.env.DATABASE_URL

if (!jwtSecret) {
  throw new Error('JWT_SECRET must be set before starting the API.')
}

if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set before starting the API.')
}

const campusTimeZone = process.env.CAMPUS_TIMEZONE || 'America/Indiana/Indianapolis'

try {
  new Intl.DateTimeFormat('en-US', { timeZone: campusTimeZone })
} catch {
  throw new Error(`CAMPUS_TIMEZONE "${campusTimeZone}" is not a valid IANA time zone.`)
}

export const JWT_SECRET = jwtSecret
/** IANA time zone used for opening hours and other campus-local rules. */
export const CAMPUS_TIMEZONE = campusTimeZone
export const DATABASE_URL = databaseUrl
export const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173'
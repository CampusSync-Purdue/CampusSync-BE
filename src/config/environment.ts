const jwtSecret = process.env.JWT_SECRET

if (!jwtSecret) {
  throw new Error('JWT_SECRET must be set before starting the API.')
}

export const JWT_SECRET = jwtSecret
export const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173'

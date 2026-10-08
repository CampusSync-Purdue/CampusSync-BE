/**
 * Browser origins allowed to call this API.
 *
 * Vite uses 5173 by default but silently moves to 5174, 5175, ... when that
 * port is already taken, so the common local ports are trusted out of the box.
 *
 * Override with a comma-separated list when needed:
 *   CORS_ALLOWED_ORIGINS=http://localhost:3000,https://campussync.example.edu
 *
 * This stays an explicit allowlist rather than reflecting any origin back:
 * once logging in sets a cookie or token, a permissive policy would let any
 * website make authenticated requests on a signed-in user's behalf.
 */
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
]

export function getAllowedOrigins(): string[] {
  const configured = process.env.CORS_ALLOWED_ORIGINS

  if (!configured) {
    return DEFAULT_ALLOWED_ORIGINS
  }

  const origins = configured
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)

  return origins.length > 0 ? origins : DEFAULT_ALLOWED_ORIGINS
}

import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../config/environment.js'
import type { UserRole } from '../types/user.js'

/**
 * Signs a token for an integration test.
 *
 * `requireAuth` and `requireRole` read the verified token and nothing else,
 * so a signed token is all a test needs to act as a given user or role. That
 * keeps these suites independent of how users are stored.
 */
export function signTestToken(options: {
  id: string
  role?: UserRole
  email?: string
  name?: string
}): string {
  return jwt.sign(
    {
      id: options.id,
      email: options.email ?? 'test-user@example.test',
      name: options.name ?? 'Test User',
      role: options.role ?? 'user',
    },
    JWT_SECRET,
    { expiresIn: '5m' },
  )
}

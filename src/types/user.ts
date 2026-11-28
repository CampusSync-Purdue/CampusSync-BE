import type { UserRecord, UserRole } from '../db/schema.js'

export type { UserRole } from '../db/schema.js'

/**
 * A user as stored in the database.
 *
 * Internal fields such as passwordHash and sessionVersion
 * must never be included in API responses.
 */
export type User = UserRecord

/**
 * The user information that is safe to return to clients.
 *
 * Explicitly listing these fields prevents newly added
 * database fields from accidentally being exposed.
 */
export type PublicUser = Pick<
  User,
  'id' | 'name' | 'email' | 'role' | 'createdAt'
>

export type RegisterUserInput = {
  name: string
  email: string
  password: string
}

export const DEFAULT_USER_ROLE: UserRole = 'user'

/**
 * Converts a database user into a public user.
 *
 * Never return passwordHash, sessionVersion,
 * or other internal account information.
 */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  }
}
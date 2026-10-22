import type { PublicUser, User } from '../types/index.js'
import {
  findUserByEmail as findStoredUserByEmail,
  findUserById as findStoredUserById,
} from '../repositories/userRepository.js'

/**
 * Sign-in lookups.
 *
 * These delegate to the user repository so that sign-in reads the same table
 * registration writes to. They used to read a hardcoded demo array, which
 * meant a registered user could never sign in, and neither could the
 * administrator created by `npm run bootstrap-admin`.
 */
export async function findUserByEmail(email: string): Promise<User | undefined> {
  return findStoredUserByEmail(email)
}

export async function findUserById(id: string): Promise<User | undefined> {
  return findStoredUserById(id)
}

export function toPublicUser({ passwordHash: _passwordHash, ...user }: User): PublicUser {
  return user
}

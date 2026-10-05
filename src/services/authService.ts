import bcrypt from 'bcryptjs'
import type { PublicUser, User } from '../types/index.js'

// Demo-only data. Replace this with a database repository in production.
const users: User[] = [
  {
    id: 'user-1',
    email: 'student@pfw.edu',
    name: 'John doe',
    passwordHash: bcrypt.hashSync('123456', 12),
  },
]

export function findUserByEmail(email: string): User | undefined {
  return users.find((user) => user.email.toLowerCase() === email.toLowerCase())
}

export function findUserById(id: string): User | undefined {
  return users.find((user) => user.id === id)
}

export function toPublicUser({ passwordHash: _passwordHash, ...user }: User): PublicUser {
  return user
}

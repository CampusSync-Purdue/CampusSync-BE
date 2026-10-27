import type { PublicUser, UserRole } from './user.js'

export type { PublicUser, User, UserRole } from './user.js'

export interface LoginCredentials {
  email: string
  password: string
}

export interface AuthTokenPayload {
  id: string
  email: string
  name: string
  role: UserRole
}

export interface AuthResponse {
  token: string
  user: PublicUser
}

export interface ErrorResponse {
  message: string
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthTokenPayload
    }
  }
}

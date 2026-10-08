export interface User {
  id: string
  email: string
  name: string
  passwordHash: string
}

export type PublicUser = Omit<User, 'passwordHash'>

export interface LoginCredentials {
  email: string
  password: string
}

export interface AuthTokenPayload {
  id: string
  email: string
  name: string
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

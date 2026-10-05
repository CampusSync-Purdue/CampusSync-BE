import bcrypt from 'bcryptjs'
import type { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../config/environment.js'
import {
  findUserByEmail,
  findUserById,
  toPublicUser,
} from '../services/authService.js'
import type {
  AuthResponse,
  AuthTokenPayload,
  ErrorResponse,
  LoginCredentials,
  PublicUser,
} from '../types/index.js'

type LoginRequest = Request<Record<string, never>, AuthResponse | ErrorResponse, Partial<LoginCredentials>>
type AuthResponseBody = AuthResponse | ErrorResponse

export async function login(
  request: LoginRequest,
  response: Response<AuthResponseBody>,
): Promise<void> {
  const { email, password } = request.body

  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    !email.trim() ||
    !password
  ) {
    response.status(400).json({ message: 'Email and password are required.' })
    return
  }

  const user = findUserByEmail(email.trim())
  const passwordMatches = user
    ? await bcrypt.compare(password, user.passwordHash)
    : false

  if (!user || !passwordMatches) {
    response.status(401).json({ message: 'Invalid email or password' })
    return
  }

  const payload: AuthTokenPayload = {
    id: user.id,
    email: user.email,
    name: user.name,
  }

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' })

  response.status(200).json({
    token,
    user: toPublicUser(user),
  })
}

export function logout(_request: Request, response: Response<{ message: string }>): void {
  // Stateless JWTs remain valid until expiration. Add token denylisting here if immediate revocation is required.
  response.status(200).json({ message: 'Logged out successfully' })
}

export function getMe(
  request: Request,
  response: Response<{ user: PublicUser } | ErrorResponse>,
): void {
  const user = request.auth ? findUserById(request.auth.id) : undefined

  if (!user) {
    response.status(401).json({ message: 'Invalid or expired token.' })
    return
  }

  response.status(200).json({ user: toPublicUser(user) })
}

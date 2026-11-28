import bcrypt from 'bcryptjs'
import type { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../config/environment.js'
import {
  findUserByEmail,
  findUserById,
} from '../repositories/userRepository.js'
import { toPublicUser } from '../types/user.js'
import type {
  AuthResponse,
  AuthTokenPayload,
  ErrorResponse,
  LoginCredentials,
  PublicUser,
} from '../types/index.js'

type LoginRequest = Request<
  Record<string, never>,
  AuthResponse | ErrorResponse,
  Partial<LoginCredentials>
>

type AuthResponseBody = AuthResponse | ErrorResponse

/**
 * POST /api/auth/login
 *
 * Authenticates a user and issues a JWT.
 *
 * CSYNC-29:
 * Includes sessionVersion so that tokens issued before a
 * successful password reset can be identified and rejected.
 */
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
    response.status(400).json({
      message: 'Email and password are required.',
    })
    return
  }

  const user = await findUserByEmail(email.trim())

  const passwordMatches = user
    ? await bcrypt.compare(password, user.passwordHash)
    : false

  if (!user || !passwordMatches) {
    response.status(401).json({
      message: 'Invalid email or password',
    })
    return
  }

  /**
   * The session version is stored in the JWT.
   *
   * After a successful password reset, the user's
   * sessionVersion increases in PostgreSQL.
   *
   * The authentication middleware will compare the
   * JWT version against the database version.
   */
  const payload: AuthTokenPayload = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    sessionVersion: user.sessionVersion,
  }

  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: '1h',
  })

  response.status(200).json({
    token,
    user: toPublicUser(user),
  })
}

/**
 * POST /api/auth/logout
 *
 * Stateless logout does not individually revoke JWTs.
 * A password reset will invalidate account sessions through
 * sessionVersion once the middleware enforces version checks.
 */
export function logout(
  _request: Request,
  response: Response<{ message: string }>,
): void {
  response.status(200).json({
    message: 'Logged out successfully',
  })
}

/**
 * GET /api/auth/me
 *
 * Returns the authenticated user's public account information.
 */
export async function getMe(
  request: Request,
  response: Response<{ user: PublicUser } | ErrorResponse>,
): Promise<void> {
  const user = request.auth
    ? await findUserById(request.auth.id)
    : undefined

  if (!user) {
    response.status(401).json({
      message: 'Invalid or expired token.',
    })
    return
  }

  response.status(200).json({
    user: toPublicUser(user),
  })
}
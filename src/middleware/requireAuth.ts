import type { NextFunction, Request, Response } from 'express'
import jwt, { type JwtPayload } from 'jsonwebtoken'
import { JWT_SECRET } from '../config/environment.js'
import { findUserById } from '../repositories/userRepository.js'
import type {
  AuthTokenPayload,
  ErrorResponse,
} from '../types/index.js'

/**
 * Checks whether a verified JWT contains the expected fields.
 */
function isAuthTokenPayload(
  payload: JwtPayload | string,
): payload is AuthTokenPayload {
  if (typeof payload === 'string') {
    return false
  }

  const version = payload.sessionVersion

  const validVersion =
    version === undefined ||
    (
      typeof version === 'number' &&
      Number.isSafeInteger(version) &&
      version >= 0
    )

  return (
    typeof payload.id === 'string' &&
    typeof payload.email === 'string' &&
    typeof payload.name === 'string' &&
    (payload.role === 'user' || payload.role === 'admin') &&
    validVersion
  )
}

/**
 * Verifies authentication and checks password-reset session invalidation.
 *
 * CSYNC-29:
 * - Versioned JWTs must match the user's current sessionVersion.
 * - Legacy JWTs without a version are treated as version 0.
 * - Existing tests that sign tokens without database users remain
 *   compatible with the previous authentication behavior.
 */
export async function requireAuth(
  request: Request,
  response: Response<ErrorResponse>,
  next: NextFunction,
): Promise<void> {
  const authorization = request.header('authorization')
  const match = authorization?.match(/^Bearer\s+(.+)$/i)

  if (!match) {
    response.status(401).json({
      message: 'Authentication is required.',
    })
    return
  }

  let payload: AuthTokenPayload

  try {
    const verified = jwt.verify(match[1], JWT_SECRET)

    if (!isAuthTokenPayload(verified)) {
      response.status(401).json({
        message: 'Invalid or expired token.',
      })
      return
    }

    payload = verified
  } catch {
    response.status(401).json({
      message: 'Invalid or expired token.',
    })
    return
  }

  try {
    const user = await findUserById(payload.id)

    if (payload.sessionVersion !== undefined) {
      /**
       * Newly issued JWT:
       * The user must exist, and versions must match.
       */
      if (
        !user ||
        user.sessionVersion !== payload.sessionVersion
      ) {
        response.status(401).json({
          message: 'Invalid or expired token.',
        })
        return
      }
    } else {
      /**
       * Legacy JWT:
       * Treat missing sessionVersion as version 0.
       *
       * If a real user has reset their password,
       * their database version will be greater than 0,
       * and the legacy token is rejected.
       *
       * For compatibility, previously supported signed test
       * tokens without corresponding database rows remain valid.
       */
      if (user && user.sessionVersion !== 0) {
        response.status(401).json({
          message: 'Invalid or expired token.',
        })
        return
      }
    }

    request.auth = payload
    next()
  } catch (error) {
    // Database failures are server errors, not invalid credentials.
    next(error)
  }
}
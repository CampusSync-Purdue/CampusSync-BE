import type { NextFunction, Request, Response } from 'express'
import jwt, { type JwtPayload } from 'jsonwebtoken'
import { JWT_SECRET } from '../config/environment.js'
import type { AuthTokenPayload, ErrorResponse } from '../types/index.js'

function isAuthTokenPayload(payload: JwtPayload | string): payload is AuthTokenPayload {
  return (
    typeof payload !== 'string' &&
    typeof payload.id === 'string' &&
    typeof payload.email === 'string' &&
    typeof payload.name === 'string'
  )
}

export function requireAuth(
  request: Request,
  response: Response<ErrorResponse>,
  next: NextFunction,
): void {
  const authorization = request.header('authorization')
  const match = authorization?.match(/^Bearer\s+(.+)$/i)

  if (!match) {
    response.status(401).json({ message: 'Authentication is required.' })
    return
  }

  try {
    const payload = jwt.verify(match[1], JWT_SECRET)

    if (!isAuthTokenPayload(payload)) {
      response.status(401).json({ message: 'Invalid or expired token.' })
      return
    }

    request.auth = payload
    next()
  } catch {
    response.status(401).json({ message: 'Invalid or expired token.' })
  }
}

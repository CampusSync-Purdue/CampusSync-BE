import type { NextFunction, Request, Response } from 'express'
import type { UserRole } from '../types/user.js'
import type { ErrorResponse } from '../types/index.js'

export function requireRole(...allowedRoles: UserRole[]) {
  return (
    request: Request,
    response: Response<ErrorResponse>,
    next: NextFunction,
  ): void => {
    if (!request.auth) {
      response.status(401).json({ message: 'Authentication is required.' })
      return
    }

    if (!allowedRoles.includes(request.auth.role)) {
      response.status(403).json({ message: 'You do not have permission to access this resource.' })
      return
    }

    next()
  }
}

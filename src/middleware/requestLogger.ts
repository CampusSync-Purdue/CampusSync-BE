import type { NextFunction, Request, Response } from 'express'
import { writeLog } from '../services/loggerService.js'

/**
 * Logs request metadata after the response finishes. Deliberately excludes
 * bodies, headers, passwords, and JWTs so authentication secrets are not logged.
 */
export function requestLogger(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const startedAt = process.hrtime.bigint()

  response.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000

    writeLog({
      level: 'info',
      timestamp: new Date().toISOString(),
      method: request.method,
      path: request.path,
      statusCode: response.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
    })
  })

  next()
}

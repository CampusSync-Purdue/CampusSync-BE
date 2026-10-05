import type { ErrorRequestHandler } from 'express'
import { writeLog } from '../services/loggerService.js'

interface HttpError extends Error {
  status?: number
  statusCode?: number
}

function getStatusCode(error: HttpError): number {
  const statusCode = error.statusCode ?? error.status

  return typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500
    ? statusCode
    : 500
}

/**
 * Global error handler. It logs diagnostic error details but returns only a
 * safe message to clients. Request bodies and headers are never logged.
 */
export const errorHandler: ErrorRequestHandler = (error: HttpError, request, response, next) => {
  const statusCode = getStatusCode(error)

  writeLog(
    {
      level: 'error',
      timestamp: new Date().toISOString(),
      method: request.method,
      path: request.path,
      statusCode,
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack,
      headersAlreadySent: response.headersSent,
    },
    true,
  )

  if (response.headersSent) {
    next(error)
    return
  }

  response.status(statusCode).json({
    message: statusCode === 400 ? 'Invalid request body.' : 'Internal server error.',
  })
}

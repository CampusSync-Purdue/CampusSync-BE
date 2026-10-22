import type { Request, Response } from 'express'
import { HTTP_STATUS_OK } from '../constants/httpStatus.js'
import { getReservationRules } from '../config/reservationRules.js'

/**
 * GET /api/reservations/rules
 *
 * Publishes the booking rules so the browser can show the limit instead of
 * hard-coding its own copy of it (US-10).
 */
export function getRules(_request: Request, response: Response) {
  response.status(HTTP_STATUS_OK).json(getReservationRules())
}

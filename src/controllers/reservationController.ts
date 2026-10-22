import type { Request, Response } from 'express'
import {
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_OK,
} from '../constants/httpStatus.js'
import { getReservationsForUser } from '../services/reservationService.js'

/**
 * GET /api/reservations/me
 *
 * Returns the signed-in user's reservations, split into upcoming and history.
 *
 * The user is taken from the verified token, never from the request, so a
 * caller cannot ask for someone else's bookings (US-11).
 */
export async function getMyReservations(request: Request, response: Response) {
  if (!request.auth) {
    // requireAuth runs before this handler, so reaching here means the route
    // was mounted without it.
    response.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      message: 'Unable to load your bookings right now. Please try again.',
    })

    return
  }

  try {
    const reservations = await getReservationsForUser(request.auth.id)

    response.status(HTTP_STATUS_OK).json(reservations)
  } catch (error) {
    console.error('Failed to load reservations', error)

    response.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      message: 'Unable to load your bookings right now. Please try again.',
    })
  }
}

import type { Request, Response } from 'express'
import {
  HTTP_STATUS_CONFLICT,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_OK,
} from '../constants/httpStatus.js'
import {
  cancelReservation,
  getAllReservations,
  getReservationsForUser,
} from '../services/reservationService.js'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

/**
 * GET /api/reservations
 *
 * Every reservation, for administrators. Provisional: US-15 (CSYNC-24) owns
 * the administrator reservation view and will want filtering and paging.
 */
export async function getAllReservationsForAdmin(
  _request: Request,
  response: Response,
) {
  try {
    response.status(HTTP_STATUS_OK).json(await getAllReservations())
  } catch (error) {
    console.error('Failed to load reservations for administrator', error)

    response.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      message: 'Unable to load reservations right now. Please try again.',
    })
  }
}

/**
 * POST /api/reservations/:reservationId/cancel
 *
 * Cancels any upcoming active reservation. Administrators only, enforced by
 * requireRole on the route (US-16).
 *
 * The record is kept and its status becomes `cancelled`, which frees the time
 * range for a new booking.
 */
export async function postCancelReservation(
  request: Request<{ reservationId: string }>,
  response: Response,
) {
  const { reservationId } = request.params

  // A malformed id would make PostgreSQL raise a type error on the uuid
  // comparison, so treat it as "no such reservation" instead.
  if (!UUID_PATTERN.test(reservationId)) {
    response.status(HTTP_STATUS_NOT_FOUND).json({
      message: 'That reservation could not be found.',
    })

    return
  }

  try {
    const result = await cancelReservation(reservationId)

    if (result.ok) {
      response.status(HTTP_STATUS_OK).json({
        message: 'The reservation has been cancelled.',
        reservation: result.reservation,
      })

      return
    }

    if (result.reason === 'not-found') {
      response.status(HTTP_STATUS_NOT_FOUND).json({
        message: 'That reservation could not be found.',
      })

      return
    }

    // 409 rather than 400: the request is well formed, the reservation is
    // simply no longer in a state that can be cancelled.
    response.status(HTTP_STATUS_CONFLICT).json({
      message:
        'Only an upcoming active reservation can be cancelled. This one has already ended or been cancelled.',
    })
  } catch (error) {
    console.error('Failed to cancel reservation', error)

    response.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      message: 'Unable to cancel the reservation right now. Please try again.',
    })
  }
}

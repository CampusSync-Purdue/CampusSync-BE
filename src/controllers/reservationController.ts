import type { Request, Response } from 'express'
import {
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_CONFLICT,
  HTTP_STATUS_CREATED,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_UNAUTHORIZED,
} from '../constants/httpStatus.js'
import {
  AccountNotFoundError,
  createReservation as createReservationForUser,
  OutsideOpeningHoursError,
  ReservationConflictError,
  RoomNotFoundError,
} from '../services/reservationService.js'
import { validateReservationInput } from '../validation/reservationValidation.js'

/** POST /api/reservations — requires requireAuth to have run. */
export async function createReservation(request: Request, response: Response) {
  const userId = request.auth?.id

  if (!userId) {
    response.status(HTTP_STATUS_UNAUTHORIZED).json({ message: 'Authentication is required.' })
    return
  }

  const validation = validateReservationInput(request.body)

  if (!validation.valid) {
    response.status(HTTP_STATUS_BAD_REQUEST).json({
      message: 'Please correct the highlighted fields.',
      errors: validation.errors,
    })
    return
  }

  try {
    // The user always comes from the verified token; any userId or status in
    // the body is ignored by validation.
    const reservation = await createReservationForUser(userId, validation.value)

    response.status(HTTP_STATUS_CREATED).json({
      message: 'Your reservation is confirmed.',
      reservation,
    })
  } catch (error) {
    if (error instanceof OutsideOpeningHoursError) {
      response.status(HTTP_STATUS_BAD_REQUEST).json({
        message: error.message,
        errors: { startTime: error.message },
      })
      return
    }

    if (error instanceof RoomNotFoundError) {
      response.status(HTTP_STATUS_NOT_FOUND).json({ message: error.message })
      return
    }

    if (error instanceof ReservationConflictError) {
      response.status(HTTP_STATUS_CONFLICT).json({
        message: error.message,
        errors: { startTime: error.message },
      })
      return
    }

    if (error instanceof AccountNotFoundError) {
      response.status(HTTP_STATUS_UNAUTHORIZED).json({ message: error.message })
      return
    }

    console.error('Failed to create reservation', error)

    response.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      message: 'Unable to create your reservation right now. Please try again.',
    })
  }
}

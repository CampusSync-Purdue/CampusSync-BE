import type { Request, Response } from 'express'
import {
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_OK,
  HTTP_STATUS_UNAUTHORIZED,
} from '../constants/httpStatus.js'
import {
  getRoomAvailability as getAvailabilityForRoom,
  RoomNotFoundError,
} from '../services/reservationService.js'
import { getActiveRooms } from '../services/roomService.js'
import { parseCalendarDate } from '../validation/reservationValidation.js'

export async function getRooms(_request: Request, response: Response) {
  const rooms = await getActiveRooms()

  response.status(HTTP_STATUS_OK).json(rooms)
}

/** GET /api/rooms/:roomId/availability?date=YYYY-MM-DD — requires requireAuth. */
export async function getRoomAvailability(
  request: Request<{ roomId: string }>,
  response: Response,
) {
  const userId = request.auth?.id

  if (!userId) {
    response.status(HTTP_STATUS_UNAUTHORIZED).json({ message: 'Authentication is required.' })
    return
  }

  const date = parseCalendarDate(request.query.date)

  if (!date) {
    response.status(HTTP_STATUS_BAD_REQUEST).json({
      message: 'Please correct the highlighted fields.',
      errors: { date: 'Enter a valid date (YYYY-MM-DD).' },
    })
    return
  }

  try {
    const availability = await getAvailabilityForRoom(request.params.roomId, date, userId)

    response.status(HTTP_STATUS_OK).json(availability)
  } catch (error) {
    if (error instanceof RoomNotFoundError) {
      response.status(HTTP_STATUS_NOT_FOUND).json({ message: error.message })
      return
    }

    throw error
  }
}

import {
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_CREATED,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_OK,
  HTTP_STATUS_UNAUTHORIZED,
} from '../constants/httpStatus.js'
import {
  getRoomAvailability as getAvailabilityForRoom,
  RoomNotFoundError,
} from '../services/reservationService.js'
import { parseCalendarDate } from '../validation/reservationValidation.js'
import type { Request, Response } from 'express'
import { createRoom, getActiveRooms } from '../services/roomService.js'
import { validateNewRoom } from '../validation/roomValidation.js'
import { findAvailableRooms } from '../services/availabilityService.js'
import { validateAvailabilityQuery } from '../validation/availabilityValidation.js'

export async function getRooms(_request: Request, response: Response) {
  try {
    response.status(HTTP_STATUS_OK).json(await getActiveRooms())
  } catch (error) {
    console.error('Failed to load rooms', error)

    response.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      message: 'Unable to load rooms right now. Please try again.',
    })
  }
}

/**
 * POST /api/rooms
 *
 * Creates a room. Administrators only, enforced by requireRole on the route.
 * The new room is active, so it appears in the catalog and the availability
 * search immediately (US-13).
 */
export async function postRoom(request: Request, response: Response) {
  const validation = validateNewRoom(request.body)

  if (!validation.valid) {
    response.status(HTTP_STATUS_BAD_REQUEST).json({
      message: 'Please correct the highlighted fields.',
      errors: validation.errors,
    })

    return
  }

  try {
    const room = await createRoom(validation.value)

    response.status(HTTP_STATUS_CREATED).json({
      message: 'The room has been created.',
      room,
    })
  } catch (error) {
    console.error('Failed to create room', error)

    response.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      message: 'Unable to create the room right now. Please try again.',
    })
  }
}

/**
 * GET /api/rooms/availability?date=&startTime=&endTime=
 *
 * Returns the active rooms a caller could book for the requested campus-local
 * window. An empty array means nothing matched, which is a valid answer
 * rather than an error, so it is still a 200.
 */
export async function getAvailableRooms(request: Request, response: Response) {
  const validation = validateAvailabilityQuery(request.query)

  if (!validation.valid) {
    response.status(HTTP_STATUS_BAD_REQUEST).json({
      message: 'Please correct the highlighted fields.',
      errors: validation.errors,
    })

    return
  }

  try {
    const rooms = await findAvailableRooms(validation.value)

    response.status(HTTP_STATUS_OK).json({
      date: validation.value.date,
      startTime: validation.value.startTime,
      endTime: validation.value.endTime,
      rooms,
    })
  } catch (error) {
    console.error('Failed to search room availability', error)

    response.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      message: 'Unable to search room availability right now. Please try again.',
    })
  }
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

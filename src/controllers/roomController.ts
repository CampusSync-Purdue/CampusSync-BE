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
import {
  createRoom,
  getActiveRoomById,
  getActiveRooms,
  getAllRooms,
  getRoomForAdmin,
  editRoom,
  deactivateRoom,
} from '../services/roomService.js'
import { validateNewRoom } from '../validation/roomValidation.js'
import { findAvailableRooms } from '../services/availabilityService.js'
import { validateAvailabilityQuery } from '../validation/availabilityValidation.js'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
 * GET /api/rooms/:roomId (US-14)
 *
 * An inactive room and an unknown id are both reported as not found, so the
 * endpoint never reveals that a room exists but is switched off. A malformed
 * id is answered the same way rather than letting Postgres raise a type error
 * on the uuid comparison.
 */
export async function getRoomById(
  request: Request<{ roomId: string }>,
  response: Response,
) {
  const { roomId } = request.params

  if (!UUID_PATTERN.test(roomId)) {
    response.status(HTTP_STATUS_NOT_FOUND).json({ message: 'Room not found.' })

    return
  }

  try {
    const room = await getActiveRoomById(roomId)

    if (!room) {
      response.status(HTTP_STATUS_NOT_FOUND).json({ message: 'Room not found.' })

      return
    }

    response.status(HTTP_STATUS_OK).json(room)
  } catch (error) {
    console.error('Failed to load room', error)

    response.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      message: 'Unable to load the room right now. Please try again.',
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


/**
 * GET /api/rooms/admin
 *
 * Returns all rooms, including inactive rooms.
 * Administrator authorization is enforced by the route.
 */
export async function getAdminRooms(
  _request: Request,
  response: Response,
) {
  try {
    const rooms = await getAllRooms()

    response.status(HTTP_STATUS_OK).json(rooms)
  } catch (error) {
    console.error('Failed to load administrator rooms', error)

    response.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      message: 'Unable to load rooms right now. Please try again.',
    })
  }
}

/**
 * GET /api/rooms/admin/:roomId
 *
 * Returns a room regardless of its active status.
 */
export async function getAdminRoomById(
  request: Request<{ roomId: string }>,
  response: Response,
) {
  try {
    const room = await getRoomForAdmin(request.params.roomId)

    if (!room) {
      response.status(HTTP_STATUS_NOT_FOUND).json({
        message: 'Room not found.',
      })
      return
    }

    response.status(HTTP_STATUS_OK).json(room)
  } catch (error) {
    console.error('Failed to load administrator room', error)

    response.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      message: 'Unable to load the room right now. Please try again.',
    })
  }
}

/**
 * PUT /api/rooms/:roomId
 *
 * Updates a room's information without changing its active status.
 * Requires administrator authorization.
 */
export async function putRoom(
  request: Request<{ roomId: string }>,
  response: Response,
) {
  if (!UUID_PATTERN.test(request.params.roomId)) {
    response.status(HTTP_STATUS_NOT_FOUND).json({
      message: 'Room not found.',
    })
    return
  }

  const validation = validateNewRoom(request.body)

  if (!validation.valid) {
    response.status(HTTP_STATUS_BAD_REQUEST).json({
      message: 'Please correct the highlighted fields.',
      errors: validation.errors,
    })
    return
  }

  try {
    const room = await editRoom(
      request.params.roomId,
      validation.value,
    )

    if (!room) {
      response.status(HTTP_STATUS_NOT_FOUND).json({
        message: 'Room not found.',
      })
      return
    }

    response.status(HTTP_STATUS_OK).json({
      message: 'The room has been updated.',
      room,
    })
  } catch (error) {
    console.error('Failed to update room', error)

    response.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      message: 'Unable to update the room right now. Please try again.',
    })
  }
}

/**
 * POST /api/rooms/:roomId/deactivate
 *
 * Marks a room inactive without deleting it or its reservations.
 * Requires administrator authorization.
 */
export async function postDeactivateRoom(
  request: Request<{ roomId: string }>,
  response: Response,
) {
  if (!UUID_PATTERN.test(request.params.roomId)) {
    response.status(HTTP_STATUS_NOT_FOUND).json({
      message: 'Room not found.',
    })
    return
  }

  try {
    const room = await deactivateRoom(request.params.roomId)

    if (!room) {
      response.status(HTTP_STATUS_NOT_FOUND).json({
        message: 'Room not found or already inactive.',
      })
      return
    }

    response.status(HTTP_STATUS_OK).json({
      message: 'The room has been deactivated.',
      room,
    })
  } catch (error) {
    console.error('Failed to deactivate room', error)

    response.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      message: 'Unable to deactivate the room right now. Please try again.',
    })
  }
}

import type { Request, Response } from 'express'
import {
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_OK,
} from '../constants/httpStatus.js'
import { getActiveRooms } from '../services/roomService.js'
import { findAvailableRooms } from '../services/availabilityService.js'
import { validateAvailabilityQuery } from '../validation/availabilityValidation.js'

export function getRooms(_request: Request, response: Response) {
  const rooms = getActiveRooms()

  response.status(HTTP_STATUS_OK).json(rooms)
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

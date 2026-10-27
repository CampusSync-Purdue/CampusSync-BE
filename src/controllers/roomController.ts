import type { Request, Response } from 'express'
import {
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_OK,
} from '../constants/httpStatus.js'
import {
  getActiveRoomById,
  getActiveRooms,
} from '../services/roomService.js'

export function getRooms(_request: Request, response: Response) {
  const rooms = getActiveRooms()

  response.status(HTTP_STATUS_OK).json(rooms)
}

export function getRoomById(request: Request, response: Response) {
  const roomIdParam = request.params.roomId
  const roomId = Array.isArray(roomIdParam) ? roomIdParam[0] : roomIdParam

  if (!roomId) {
    response.status(HTTP_STATUS_NOT_FOUND).json({
      message: 'Room not found.',
    })
    return
  }

  const room = getActiveRoomById(roomId)

  if (!room) {
    response.status(HTTP_STATUS_NOT_FOUND).json({
      message: 'Room not found.',
    })
    return
  }

  response.status(HTTP_STATUS_OK).json(room)
}
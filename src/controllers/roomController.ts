import type { Request, Response } from 'express'
import { HTTP_STATUS_OK } from '../constants/httpStatus.js'
import { getActiveRooms } from '../services/roomService.js'

export function getRooms(_request: Request, response: Response) {
  const rooms = getActiveRooms()

  response.status(HTTP_STATUS_OK).json(rooms)
}

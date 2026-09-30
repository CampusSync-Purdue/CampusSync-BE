import type { Request, Response } from "express";
import { getActiveRooms } from "../services/roomService.js";

export function getRooms(_request: Request, response: Response) {
  const rooms = getActiveRooms();

  response.status(200).json(rooms);
}

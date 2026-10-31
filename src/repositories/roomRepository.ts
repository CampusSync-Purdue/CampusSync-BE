import { pool } from '../config/database.js'
import type { Room } from '../types/room.js'

type ActiveRoom = Omit<Room, 'active'>

export async function findActiveRooms(): Promise<ActiveRoom[]> {
  const result = await pool.query<ActiveRoom>(
    `SELECT id, name, location, capacity, amenities
     FROM rooms
     WHERE is_active = TRUE
     ORDER BY name`,
  )

  return result.rows
}
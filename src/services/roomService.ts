import { findActiveRooms } from '../repositories/roomRepository.js'
import type { Room } from '../types/room.js'

type ActiveRoom = Omit<Room, 'active'>

export async function getActiveRooms(): Promise<ActiveRoom[]> {
  return findActiveRooms()
}
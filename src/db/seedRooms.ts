import { sql } from 'drizzle-orm'
import type { Database } from './index.js'
import { DAYS_OF_WEEK, rooms, type NewRoomRecord, type OpeningHours } from './schema.js'

/** Campus-local hours every demo room is open, every day of the week. */
export const DEFAULT_OPENING_HOURS: OpeningHours = Object.fromEntries(
  DAYS_OF_WEEK.map((day) => [day, { open: '08:00', close: '20:00' }]),
)

/** Fixed ids so seeding is repeatable and links stay stable across resets. */
export const DEMO_ROOMS: NewRoomRecord[] = [
  {
    id: '2f6b1c4e-8a3d-4f5b-9c71-0d2e3a4b5c01',
    name: 'Study Room 101',
    location: 'Library',
    capacity: 8,
    amenities: ['WiFi', 'Whiteboard'],
    availabilityHours: DEFAULT_OPENING_HOURS,
    isActive: true,
  },
  {
    id: '2f6b1c4e-8a3d-4f5b-9c71-0d2e3a4b5c02',
    name: 'Conference Room A',
    location: 'Science Hall',
    capacity: 12,
    amenities: ['WiFi', 'Projector', 'Whiteboard'],
    availabilityHours: DEFAULT_OPENING_HOURS,
    isActive: true,
  },
  {
    id: '2f6b1c4e-8a3d-4f5b-9c71-0d2e3a4b5c03',
    name: 'Study Room 303',
    location: 'Engineering Building',
    capacity: 6,
    amenities: ['WiFi'],
    availabilityHours: DEFAULT_OPENING_HOURS,
    isActive: false,
  },
]

/** Inserts the demo rooms, or updates them in place if they already exist. */
export async function seedRooms(db: Database): Promise<void> {
  await db
    .insert(rooms)
    .values(DEMO_ROOMS)
    .onConflictDoUpdate({
      target: rooms.id,
      set: {
        name: sql`excluded.name`,
        location: sql`excluded.location`,
        capacity: sql`excluded.capacity`,
        amenities: sql`excluded.amenities`,
        availabilityHours: sql`excluded.availability_hours`,
        isActive: sql`excluded.is_active`,
        updatedAt: sql`now()`,
      },
    })
}

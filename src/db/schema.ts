import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

/**
 * Source of truth for the database schema. Change this file, then run
 * `npm run db:generate` to create a migration and `npm run db:migrate` to
 * apply it.
 *
 * Drizzle cannot express the reservation overlap EXCLUDE constraint or the
 * btree_gist extension it needs, so those live in a hand-written migration
 * (drizzle/0001_reservation_overlap.sql).
 */

export const USER_ROLES = ['user', 'admin'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const RESERVATION_STATUSES = ['active', 'cancelled', 'completed'] as const
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number]

export const DAYS_OF_WEEK = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number]

/** Campus-local opening hours per weekday, e.g. { monday: { open: '08:00', close: '20:00' } }. */
export type OpeningHours = Partial<Record<DayOfWeek, { open: string; close: string }>>

const createdAt = () =>
  timestamp('created_at', { withTimezone: true }).notNull().defaultNow()

const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date())

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: text('role', { enum: USER_ROLES }).notNull().default('user'),
    createdAt: createdAt(),
  },
  () => [
    // Case-insensitive uniqueness lets users sign in regardless of the casing
    // they registered with.
    uniqueIndex('users_email_lower_unique').using('btree', sql`lower(email)`),
    check('users_name_not_blank', sql`char_length(trim(name)) > 0`),
    check('users_role_check', sql`role IN ('user', 'admin')`),
  ],
)

export const rooms = pgTable(
  'rooms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    location: text('location').notNull(),
    capacity: integer('capacity').notNull(),
    description: text('description').notNull().default(''),
    amenities: text('amenities').array().notNull().default(sql`'{}'::text[]`),
    availabilityHours: jsonb('availability_hours')
      .$type<OpeningHours>()
      .notNull()
      .default({}),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('rooms_active_location_idx').on(table.location).where(sql`is_active`),
    index('rooms_active_capacity_idx').on(table.capacity).where(sql`is_active`),
    check('rooms_name_not_blank', sql`char_length(trim(name)) > 0`),
    check('rooms_location_not_blank', sql`char_length(trim(location)) > 0`),
    check('rooms_capacity_positive', sql`capacity > 0`),
  ],
)

export const reservations = pgTable(
  'reservations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id),
    startTime: timestamp('start_time', { withTimezone: true }).notNull(),
    endTime: timestamp('end_time', { withTimezone: true }).notNull(),
    status: text('status', { enum: RESERVATION_STATUSES })
      .notNull()
      .default('active'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('reservations_user_start_time_idx').on(table.userId, table.startTime),
    index('reservations_room_start_time_idx').on(table.roomId, table.startTime),
    check(
      'reservations_status_check',
      sql`status IN ('active', 'cancelled', 'completed')`,
    ),
    check('reservations_end_after_start', sql`end_time > start_time`),
  ],
)

export type UserRecord = typeof users.$inferSelect
export type NewUserRecord = typeof users.$inferInsert
export type RoomRecord = typeof rooms.$inferSelect
export type NewRoomRecord = typeof rooms.$inferInsert
export type ReservationRecord = typeof reservations.$inferSelect
export type NewReservationRecord = typeof reservations.$inferInsert

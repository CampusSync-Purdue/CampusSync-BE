import { isUuid } from './uuid.js'
import type { ReservationStatus } from '../types/reservation.js'

/**
 * Validation for the administrator reservation list (CSYNC-24 / US-15).
 *
 * Every parameter is optional. An empty value is treated as absent, so a
 * form that submits a blank "All rooms" choice does not trip validation.
 * Anything else that is not one of the allowed values is rejected with a
 * per-field message rather than silently ignored, so a typo in a filter can
 * never be mistaken for "no matches".
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export const ADMIN_RESERVATION_STATUSES = [
  'active',
  'cancelled',
  'completed',
] as const satisfies readonly ReservationStatus[]

export const ADMIN_RESERVATION_SORT_FIELDS = ['date', 'room', 'status'] as const
export type AdminReservationSortField =
  (typeof ADMIN_RESERVATION_SORT_FIELDS)[number]

export const SORT_ORDERS = ['asc', 'desc'] as const
export type SortOrder = (typeof SORT_ORDERS)[number]

export type AdminReservationQuery = {
  /** Campus-local calendar date, `YYYY-MM-DD`. Matches reservations starting that day. */
  date?: string
  roomId?: string
  /** The derived status, as callers see it. */
  status?: ReservationStatus
  sort: AdminReservationSortField
  order: SortOrder
}

export type AdminReservationFieldErrors = Partial<
  Record<'date' | 'roomId' | 'status' | 'sort' | 'order', string>
>

export type AdminReservationValidationResult =
  | { valid: true; value: AdminReservationQuery }
  | { valid: false; errors: AdminReservationFieldErrors }

/** Newest first, matching how the list was ordered before filtering existed. */
export const DEFAULT_SORT: AdminReservationSortField = 'date'
export const DEFAULT_ORDER: SortOrder = 'desc'

/** Rejects values that match the pattern but do not exist, such as `2026-02-30`. */
function isRealDate(date: string): boolean {
  const [year, month, day] = date.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  )
}

/**
 * Reads one query parameter. `undefined` means absent; `null` means present
 * but not a single string (for example `?status=a&status=b`), which is
 * always an error.
 */
function readParam(input: Record<string, unknown>, key: string): string | undefined | null {
  const value = input[key]
  if (value === undefined) {
    return undefined
  }
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length === 0 ? undefined : trimmed
}

function isOneOf<T extends string>(value: string, allowed: readonly T[]): value is T {
  return (allowed as readonly string[]).includes(value)
}

export function validateAdminReservationQuery(
  query: unknown,
): AdminReservationValidationResult {
  const input = (query ?? {}) as Record<string, unknown>
  const errors: AdminReservationFieldErrors = {}

  const date = readParam(input, 'date')
  const roomId = readParam(input, 'roomId')
  const status = readParam(input, 'status')
  const sort = readParam(input, 'sort')
  const order = readParam(input, 'order')

  if (date === null || (date !== undefined && (!DATE_PATTERN.test(date) || !isRealDate(date)))) {
    errors.date = 'Enter a valid date (YYYY-MM-DD).'
  }

  if (roomId === null || (roomId !== undefined && !isUuid(roomId))) {
    errors.roomId = 'Choose a valid room.'
  }

  if (status === null || (status !== undefined && !isOneOf(status, ADMIN_RESERVATION_STATUSES))) {
    errors.status = `Status must be one of: ${ADMIN_RESERVATION_STATUSES.join(', ')}.`
  }

  if (sort === null || (sort !== undefined && !isOneOf(sort, ADMIN_RESERVATION_SORT_FIELDS))) {
    errors.sort = `Sort must be one of: ${ADMIN_RESERVATION_SORT_FIELDS.join(', ')}.`
  }

  if (order === null || (order !== undefined && !isOneOf(order, SORT_ORDERS))) {
    errors.order = `Order must be one of: ${SORT_ORDERS.join(', ')}.`
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors }
  }

  return {
    valid: true,
    value: {
      ...(date ? { date } : {}),
      ...(roomId ? { roomId: roomId.toLowerCase() } : {}),
      ...(status ? { status: status as ReservationStatus } : {}),
      sort: (sort as AdminReservationSortField | undefined) ?? DEFAULT_SORT,
      order: (order as SortOrder | undefined) ?? DEFAULT_ORDER,
    },
  }
}

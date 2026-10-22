import {
  cancelReservationById,
  findAllReservations,
  findReservationById,
  findReservationsByUserId,
  type ReservationWithRoom,
} from '../repositories/reservationRepository.js'
import {
  deriveReservationStatus,
  deriveReservationTimeframe,
  isCancellable,
} from './reservationStatus.js'
import type { ReservationView } from '../types/reservation.js'

/**
 * Reservation reads (CSYNC-20 / US-11).
 *
 * Every status shown to a caller comes from `reservationStatus`, never
 * straight from the `status` column, so the user view and the administrator
 * view (US-15) cannot disagree about what "completed" means. See
 * `docs/reservation-status-model.md`.
 */

/** The two sections the My Bookings page shows. */
export type GroupedReservations = {
  upcoming: ReservationView[]
  past: ReservationView[]
}

function toView(
  reservation: ReservationWithRoom,
  now: Date,
): ReservationView {
  const { status, roomId: _roomId, ...rest } = reservation

  return {
    ...rest,
    status: deriveReservationStatus(status, reservation.endTime, now),
    timeframe: deriveReservationTimeframe(status, reservation.endTime, now),
  }
}

/**
 * One user's reservations, split into the sections the page renders.
 *
 * Upcoming bookings run soonest first, because the next one matters most.
 * History runs most recent first, because that is the one just finished.
 */
export async function getReservationsForUser(
  userId: string,
  now: Date = new Date(),
): Promise<GroupedReservations> {
  const reservations = await findReservationsByUserId(userId)
  const views = reservations.map((reservation) => toView(reservation, now))

  return {
    upcoming: views
      .filter((view) => view.timeframe === 'upcoming')
      .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    past: views
      .filter((view) => view.timeframe === 'past')
      .sort((a, b) => b.startTime.localeCompare(a.startTime)),
  }
}

/** Why a cancellation could not be carried out. */
export type CancellationFailure = 'not-found' | 'not-cancellable'

export type CancellationResult =
  | { ok: true; reservation: ReservationView }
  | { ok: false; reason: CancellationFailure }

/**
 * Every reservation, for the administrator view.
 *
 * Provisional: US-15 (CSYNC-24) owns that view and will want filtering and
 * paging. Statuses are derived here too, so it cannot disagree with the user
 * view about what "completed" means.
 */
export async function getAllReservations(
  now: Date = new Date(),
): Promise<GroupedReservations> {
  const views = (await findAllReservations()).map((reservation) =>
    toView(reservation, now),
  )

  return {
    upcoming: views
      .filter((view) => view.timeframe === 'upcoming')
      .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    past: views
      .filter((view) => view.timeframe === 'past')
      .sort((a, b) => b.startTime.localeCompare(a.startTime)),
  }
}

/**
 * Cancels a reservation on an administrator's behalf (US-16).
 *
 * Only an upcoming active reservation can be cancelled: one that has already
 * ended is history, and cancelling it would rewrite the record rather than
 * free anything. An already-cancelled one is refused rather than reported as
 * a fresh success.
 *
 * The row is kept and its status becomes `cancelled`, which frees the time
 * range for a new booking because the exclusion constraint only covers
 * active rows.
 */
export async function cancelReservation(
  reservationId: string,
  now: Date = new Date(),
): Promise<CancellationResult> {
  const existing = await findReservationById(reservationId)

  if (!existing) {
    return { ok: false, reason: 'not-found' }
  }

  if (!isCancellable(existing, now)) {
    return { ok: false, reason: 'not-cancellable' }
  }

  const cancelled = await cancelReservationById(reservationId)

  if (!cancelled) {
    // Another request cancelled it between the read and the write.
    return { ok: false, reason: 'not-cancellable' }
  }

  return { ok: true, reservation: toView(cancelled, now) }
}

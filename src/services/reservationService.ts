import {
  findReservationsByUserId,
  type ReservationWithRoom,
} from '../repositories/reservationRepository.js'
import {
  deriveReservationStatus,
  deriveReservationTimeframe,
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

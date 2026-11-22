import { Router } from "express";
import { getRules } from "../controllers/reservationRulesController.js";
import {
  createReservation,
  getAllReservationsForAdmin,
  getMyReservations,
  postCancelMyReservation,
  postCancelReservation,
} from "../controllers/reservationController.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";

const router = Router();

// Reservation rules
router.get("/rules", getRules);

// Creating a reservation (CSYNC-17).
// Any authenticated user may book a room.
router.post("/", requireAuth, createReservation);

// View the authenticated user's reservations (CSYNC-20).
router.get("/me", requireAuth, getMyReservations);

// Cancel the authenticated user's own reservation (CSYNC-21).
router.post(
  "/me/:reservationId/cancel",
  requireAuth,
  postCancelMyReservation,
);

// View all reservations (administrators only).
router.get(
  "/",
  requireAuth,
  requireRole("admin"),
  getAllReservationsForAdmin,
);

// Cancel any eligible reservation (administrators only).
router.post(
  "/:reservationId/cancel",
  requireAuth,
  requireRole("admin"),
  postCancelReservation,
);

export default router;
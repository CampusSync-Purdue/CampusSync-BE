import { Router } from "express";
import { getRules } from "../controllers/reservationRulesController.js";
import {
  createReservation,
  getAllReservationsForAdmin,
  getMyReservations,
  postCancelReservation,
} from "../controllers/reservationController.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";

const router = Router();

router.get("/rules", getRules);
// Creating a reservation (CSYNC-17). Any signed-in user may book.
router.post("/", requireAuth, createReservation);
router.get("/me", requireAuth, getMyReservations);
router.get("/", requireAuth, requireRole("admin"), getAllReservationsForAdmin);
// POST rather than PATCH: the API's CORS configuration allows GET and POST,
// and cancelling is a named action rather than an arbitrary field update.
router.post(
  "/:reservationId/cancel",
  requireAuth,
  requireRole("admin"),
  postCancelReservation,
);

export default router;

import { Router } from "express";
import { getRules } from "../controllers/reservationRulesController.js";
import { getMyReservations } from "../controllers/reservationController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.get("/rules", getRules);
router.get("/me", requireAuth, getMyReservations);

export default router;

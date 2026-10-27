import { Router } from "express";
import { getRoomAvailability, getRooms } from "../controllers/roomController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.get("/", getRooms);
// Signed-in users only: a room's schedule is not public.
router.get("/:roomId/availability", requireAuth, getRoomAvailability);

export default router;

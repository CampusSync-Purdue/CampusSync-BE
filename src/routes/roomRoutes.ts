import { Router } from "express";
import {
  getAvailableRooms,
  getRooms,
  postRoom,
} from "../controllers/roomController.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";

const router = Router();

router.get("/", getRooms);
// Declared before any "/:roomId" route so that "availability" is not read as
// a room identifier.
router.get("/availability", getAvailableRooms);
router.post("/", requireAuth, requireRole("admin"), postRoom);

export default router;

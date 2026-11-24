import { Router } from "express";
import {
  getAvailableRooms,
  getRoomAvailability,
  getRoomById,
  getRooms,
  postRoom,
  getAdminRooms,
  getAdminRoomById,
  putRoom,
  postDeactivateRoom,
} from "../controllers/roomController.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";

const router = Router();

// Public room catalog.
router.get("/", getRooms);

// Availability search must be declared before /:roomId.
router.get("/availability", getAvailableRooms);

// Administrator room management (CSYNC-23).
router.get(
  "/admin",
  requireAuth,
  requireRole("admin"),
  getAdminRooms,
);

router.get(
  "/admin/:roomId",
  requireAuth,
  requireRole("admin"),
  getAdminRoomById,
);

// Existing room creation (CSYNC-22).
router.post("/", requireAuth, requireRole("admin"), postRoom);

// CSYNC-23: Update room information.
router.put(
  "/:roomId",
  requireAuth,
  requireRole("admin"),
  putRoom,
);

// CSYNC-23: Deactivate a room without deleting reservations.
router.post(
  "/:roomId/deactivate",
  requireAuth,
  requireRole("admin"),
  postDeactivateRoom,
);

// Existing room availability endpoint.
router.get(
  "/:roomId/availability",
  requireAuth,
  getRoomAvailability,
);

// Keep the general room lookup last.
router.get("/:roomId", getRoomById);

export default router;

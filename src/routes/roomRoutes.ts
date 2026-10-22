import { Router } from "express";
import { getAvailableRooms, getRooms } from "../controllers/roomController.js";

const router = Router();

router.get("/", getRooms);
// Declared before any "/:roomId" route so that "availability" is not read as
// a room identifier.
router.get("/availability", getAvailableRooms);

export default router;

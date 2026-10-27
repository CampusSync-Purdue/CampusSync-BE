import { Router } from "express";
import {
  getRoomById,
  getRooms,
} from "../controllers/roomController.js";

const router = Router();

router.get("/", getRooms);
router.get("/:roomId", getRoomById);

export default router;

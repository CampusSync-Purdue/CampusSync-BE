import { Router } from "express";
import { getRooms } from "../controllers/roomController.js";

const router = Router();

router.get("/", getRooms);

export default router;

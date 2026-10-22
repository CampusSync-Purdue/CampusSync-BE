import { Router } from "express";
import { getRules } from "../controllers/reservationRulesController.js";

const router = Router();

router.get("/rules", getRules);

export default router;

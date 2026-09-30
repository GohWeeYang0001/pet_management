import { Router } from "express";
import { getMonthlyReport } from "../controllers/reportController";

const router = Router();
router.get("/monthly", getMonthlyReport);
export default router;

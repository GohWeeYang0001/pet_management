import { Router } from "express";
import { createService, getActiveServices, updateService } from "../controllers/serviceController";

const router = Router();
router.get("/", getActiveServices);
router.post("/", createService);
router.put("/:id", updateService);

export default router;

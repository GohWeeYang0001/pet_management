import { Router } from "express";
import { getTravelFeeOptions, createTravelFeeOption, updateTravelFeeOption } from "../controllers/travelFeeController";
const router = Router();
router.get("/",getTravelFeeOptions);
router.post("/",createTravelFeeOption);
router.put("/:id",updateTravelFeeOption);
export default router;

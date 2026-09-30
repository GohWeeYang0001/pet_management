import { Router } from "express";

import {
    getAppointments,
    createAppointment,
    completeAppointment
} from "../controllers/appointmentController";

const router = Router();

router.get("/", getAppointments);
router.post("/", createAppointment);
router.patch("/:id/complete", completeAppointment);

export default router;

import { Router } from "express";

import {
    getAppointments,
    createAppointment,
    completeAppointment,
    editAppointment,
    cancelAppointment
} from "../controllers/appointmentController";

const router = Router();

router.get("/", getAppointments);
router.post("/", createAppointment);
router.patch("/:id/complete", completeAppointment);
router.patch("/:id/cancel", cancelAppointment);
router.patch("/:id", editAppointment);

export default router;

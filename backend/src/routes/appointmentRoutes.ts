import { Router } from "express";

import {
    getAppointments,
    getAppointmentById,
    createAppointment,
    completeAppointment,
    editAppointment,
    cancelAppointment
} from "../controllers/appointmentController";

const router = Router();

router.get("/", getAppointments);
router.get("/:id", getAppointmentById);
router.post("/", createAppointment);
router.patch("/:id/complete", completeAppointment);
router.patch("/:id/cancel", cancelAppointment);
router.patch("/:id", editAppointment);

export default router;

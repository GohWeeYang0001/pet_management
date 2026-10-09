import { Router } from "express";

import {
    getCustomers,
    getCustomerById,
    createCustomer,
    updateCustomer,
    deleteCustomer
} from "../controllers/customerController";
import { getCustomerOverview, getCustomerAppointments } from "../controllers/customerController";
import petRoutes from "./petRoutes";
import { archiveCustomer } from "../controllers/recordManagementController";
import customerAddressRoutes from "./customerAddressRoutes";

const router = Router();

router.get("/", getCustomers);
router.use("/:customerId/pets", petRoutes);
router.use("/:customerId/addresses", customerAddressRoutes);
router.get("/:id/overview", getCustomerOverview);
router.get("/:id/appointments", getCustomerAppointments);

router.get("/:id", getCustomerById);

router.post("/", createCustomer);

router.put("/:id", updateCustomer);
router.patch("/:id/archive", archiveCustomer);

router.delete("/:id", deleteCustomer);

export default router;

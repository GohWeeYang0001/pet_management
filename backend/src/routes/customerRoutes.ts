import { Router } from "express";

import {
    getCustomers,
    getCustomerById,
    createCustomer,
    updateCustomer,
    deleteCustomer
} from "../controllers/customerController";
import { getCustomerOverview } from "../controllers/customerController";
import petRoutes from "./petRoutes";

const router = Router();

router.get("/", getCustomers);
router.use("/:customerId/pets", petRoutes);
router.get("/:id/overview", getCustomerOverview);

router.get("/:id", getCustomerById);

router.post("/", createCustomer);

router.put("/:id", updateCustomer);

router.delete("/:id", deleteCustomer);

export default router;

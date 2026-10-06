import { Router } from "express";
import { createCustomerAddress, getCustomerAddresses, updateCustomerAddress } from "../controllers/customerAddressController";

const router = Router({ mergeParams: true });
router.get("/", getCustomerAddresses);
router.post("/", createCustomerAddress);
router.put("/:addressId", updateCustomerAddress);
export default router;

import { Router } from "express";
import { createCustomerPet, getCustomerPets, updateCustomerPet } from "../controllers/petController";
import { getCustomerPet,deleteCustomerPet,archiveCustomerPet } from "../controllers/recordManagementController";

const router = Router({ mergeParams: true });
router.get("/", getCustomerPets);
router.post("/", createCustomerPet);
router.put("/:petId", updateCustomerPet);
router.get("/:petId",getCustomerPet);
router.delete("/:petId",deleteCustomerPet);
router.patch("/:petId/archive",archiveCustomerPet);

export default router;

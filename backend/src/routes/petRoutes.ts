import { Router } from "express";
import { createCustomerPet, getCustomerPets, updateCustomerPet } from "../controllers/petController";

const router = Router({ mergeParams: true });
router.get("/", getCustomerPets);
router.post("/", createCustomerPet);
router.put("/:petId", updateCustomerPet);

export default router;

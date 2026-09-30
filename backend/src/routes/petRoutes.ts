import { Router } from "express";
import { createCustomerPet, getCustomerPets } from "../controllers/petController";

const router = Router({ mergeParams: true });
router.get("/", getCustomerPets);
router.post("/", createCustomerPet);

export default router;

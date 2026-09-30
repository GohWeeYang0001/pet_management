import { Router } from "express";
import {
    createInventoryItem, getInventory, getInventoryTransactions,
    stockIn, stockOut, updateInventoryItem,
} from "../controllers/inventoryController";

const router = Router();
router.get("/", getInventory);
router.post("/", createInventoryItem);
router.get("/:id/transactions", getInventoryTransactions);
router.put("/:id", updateInventoryItem);
router.post("/:id/stock-in", stockIn);
router.post("/:id/stock-out", stockOut);
export default router;

import { Request, Response } from "express";
import { pool } from "../db";

async function customerExists(customerId: string): Promise<boolean> {
    const result = await pool.query(
        "SELECT 1 FROM customer WHERE customer_id = $1",
        [customerId],
    );
    return result.rowCount !== 0;
}

export async function getCustomerPets(req: Request, res: Response): Promise<void> {
    const customerId = String(req.params.customerId);
    if (!/^\d+$/.test(customerId)) {
        res.status(400).json({ message: "Invalid customer ID" });
        return;
    }
    try {
        if (!(await customerExists(customerId))) {
            res.status(404).json({ message: "Customer not found" });
            return;
        }
        const result = await pool.query(
            `SELECT pet_id, customer_id, pet_name, pet_type, pet_remark
             FROM pet WHERE customer_id = $1 ORDER BY pet_name, pet_id`,
            [customerId],
        );
        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching customer pets:", error);
        res.status(500).json({ message: "Failed to fetch pets" });
    }
}

export async function createCustomerPet(req: Request, res: Response): Promise<void> {
    const customerId = String(req.params.customerId);
    const { pet_name, pet_type, pet_remark } = req.body ?? {};
    if (!/^\d+$/.test(customerId) || typeof pet_name !== "string" || !pet_name.trim() ||
        (pet_type != null && typeof pet_type !== "string") ||
        (pet_remark != null && typeof pet_remark !== "string")) {
        res.status(400).json({ message: "A valid customer and pet name are required" });
        return;
    }
    try {
        if (!(await customerExists(customerId))) {
            res.status(404).json({ message: "Customer not found" });
            return;
        }
        const result = await pool.query(
            `INSERT INTO pet (customer_id, pet_name, pet_type, pet_remark)
             VALUES ($1, $2, $3, $4)
             RETURNING pet_id, customer_id, pet_name, pet_type, pet_remark`,
            [customerId, pet_name.trim(), pet_type?.trim() || null, pet_remark?.trim() || null],
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("Error creating customer pet:", error);
        res.status(500).json({ message: "Failed to create pet" });
    }
}

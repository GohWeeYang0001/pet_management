import { logServerError } from "../logging";
import { Request, Response } from "express";
import { pool } from "../db";
import { isBusinessId } from "../business/catalog";
import { petManagementColumns } from "../business/recordManagement";
import { isOptionalText, isText } from "../validation";

async function customerExists(customerId: string): Promise<boolean> {
    const result = await pool.query(
        "SELECT 1 FROM customer WHERE customer_id = $1",
        [customerId],
    );
    return result.rowCount !== 0;
}

export async function getCustomerPets(req: Request, res: Response): Promise<void> {
    const customerId = String(req.params.customerId);
    if (!isBusinessId(customerId)) {
        res.status(400).json({ message: "Invalid customer ID" });
        return;
    }
    try {
        if (!(await customerExists(customerId))) {
            res.status(404).json({ message: "Customer not found" });
            return;
        }
        const result = await pool.query(
            `SELECT ${petManagementColumns} FROM pet p WHERE p.customer_id=$1 AND ($2::boolean OR NOT p.is_archived) ORDER BY p.pet_name,p.pet_id`,
            [customerId,req.query.include_archived === "true"],
        );
        res.json(result.rows);
    } catch (error) {
        logServerError("Error fetching customer pets:", error);
        res.status(500).json({ message: "Failed to fetch pets" });
    }
}

export async function createCustomerPet(req: Request, res: Response): Promise<void> {
    const customerId = String(req.params.customerId);
    const { pet_name, pet_type, pet_remark } = req.body ?? {};
    if (!isBusinessId(customerId) || !isText(pet_name,100) ||
        (pet_type != null && !isText(pet_type,50,false)) ||
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
             RETURNING pet_id, customer_id, pet_name, pet_type, pet_remark,is_archived`,
            [customerId, pet_name.trim(), pet_type?.trim() || null, pet_remark?.trim() || null],
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        logServerError("Error creating customer pet:", error);
        res.status(500).json({ message: "Failed to create pet" });
    }
}

export async function updateCustomerPet(req: Request, res: Response): Promise<void> {
    const { customerId, petId } = req.params;
    const { pet_name, pet_type, pet_remark } = req.body ?? {};
    if (!isBusinessId(customerId) || !isBusinessId(petId) || !isText(pet_name, 100) ||
        (pet_type != null && !isText(pet_type, 50, false)) || !isOptionalText(pet_remark)) {
        res.status(400).json({ message: "Valid customer, pet and pet name are required" });
        return;
    }
    try {
        if (!(await customerExists(String(customerId)))) {
            res.status(404).json({ message: "Customer not found" });
            return;
        }
        const result = await pool.query(
            `UPDATE pet SET pet_name = $1, pet_type = $2, pet_remark = $3
             WHERE pet_id = $4 AND customer_id = $5
             RETURNING pet_id, customer_id, pet_name, pet_type, pet_remark,is_archived`,
            [pet_name.trim(), pet_type?.trim() || null, pet_remark?.trim() || null, petId, customerId],
        );
        if (result.rowCount === 0) {
            res.status(404).json({ message: "Pet not found for this customer" });
            return;
        }
        res.json(result.rows[0]);
    } catch (error) {
        logServerError("Error updating customer pet:", error);
        res.status(500).json({ message: "Failed to update pet" });
    }
}

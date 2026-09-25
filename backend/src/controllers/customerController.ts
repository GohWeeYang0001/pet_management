import { Request, Response } from "express";
import { pool } from "../db";

export async function getCustomers(
    req: Request,
    res: Response
): Promise<void> {
    try {
        const result = await pool.query(`
            SELECT
                customer_id,
                customer_name,
                customer_hp,
                created_at
            FROM customer
            ORDER BY customer_id
        `);

        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching customers:", error);

        res.status(500).json({
            message: "Internal server error"
        });
    }
}

export async function getCustomerById(
    req: Request,
    res: Response
): Promise<void> {
    const { id } = req.params;

    try {
        const result = await pool.query(
            `
            SELECT
                customer_id,
                customer_name,
                customer_hp,
                created_at
            FROM customer
            WHERE customer_id = $1
            `,
            [id]
        );

        if (result.rows.length === 0) {
            res.status(404).json({
                message: "Customer not found"
            });
            return;
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Error fetching customer:", error);

        res.status(500).json({
            message: "Internal server error"
        });
    }
}

export async function createCustomer(
    req: Request,
    res: Response
): Promise<void> {
    const { customer_name, customer_hp } = req.body;

    if (!customer_name || !customer_hp) {
        res.status(400).json({
            message: "Customer name and phone number are required"
        });
        return;
    }

    try {
        const result = await pool.query(
            `
            INSERT INTO customer (
                customer_name,
                customer_hp
            )
            VALUES ($1, $2)
            RETURNING
                customer_id,
                customer_name,
                customer_hp,
                created_at
            `,
            [customer_name, customer_hp]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("Error creating customer:", error);

        res.status(500).json({
            message: "Internal server error"
        });
    }
}

export async function updateCustomer(
    req: Request,
    res: Response
): Promise<void> {
    const { id } = req.params;
    const { customer_name, customer_hp } = req.body;

    if (!customer_name || !customer_hp) {
        res.status(400).json({
            message: "Customer name and phone number are required"
        });
        return;
    }

    try {
        const result = await pool.query(
            `
            UPDATE customer
            SET
                customer_name = $1,
                customer_hp = $2
            WHERE customer_id = $3
            RETURNING
                customer_id,
                customer_name,
                customer_hp,
                created_at
            `,
            [customer_name, customer_hp, id]
        );

        if (result.rows.length === 0) {
            res.status(404).json({
                message: "Customer not found"
            });
            return;
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Error updating customer:", error);

        res.status(500).json({
            message: "Internal server error"
        });
    }
}

export async function deleteCustomer(
    req: Request,
    res: Response
): Promise<void> {
    const { id } = req.params;

    try {
        const result = await pool.query(
            `
            DELETE FROM customer
            WHERE customer_id = $1
            RETURNING
                customer_id,
                customer_name,
                customer_hp
            `,
            [id]
        );

        if (result.rows.length === 0) {
            res.status(404).json({
                message: "Customer not found"
            });
            return;
        }

        res.json({
            message: "Customer deleted successfully",
            customer: result.rows[0]
        });
    } catch (error) {
        console.error("Error deleting customer:", error);

        res.status(500).json({
            message: "Internal server error"
        });
    }
}
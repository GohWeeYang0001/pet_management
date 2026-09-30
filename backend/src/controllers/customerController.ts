import { logServerError } from "../logging";
import { Request, Response } from "express";
import { pool } from "../db";
import { isId } from "../validation";

export async function getCustomers(
    req: Request,
    res: Response
): Promise<void> {
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    try {
        const result = await pool.query(`
            SELECT
                c.customer_id, c.customer_name, c.customer_hp, c.created_at,
                COUNT(p.pet_id)::integer AS pet_count
            FROM customer c
            LEFT JOIN pet p ON p.customer_id = c.customer_id
            WHERE $1 = '' OR c.customer_name ILIKE '%' || $1 || '%'
                OR c.customer_hp ILIKE '%' || $1 || '%'
            GROUP BY c.customer_id
            ORDER BY c.customer_name, c.customer_id
        `, [search]);

        res.json(result.rows);
    } catch (error) {
        logServerError("Error fetching customers:", error);

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
        logServerError("Error fetching customer:", error);

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
        logServerError("Error creating customer:", error);

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
        logServerError("Error updating customer:", error);

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
        logServerError("Error deleting customer:", error);

        res.status(500).json({
            message: "Internal server error"
        });
    }
}

export async function getCustomerOverview(req: Request, res: Response): Promise<void> {
    const id = req.params.id;
    if (!isId(id)) {
        res.status(400).json({ message: "Invalid customer ID" });
        return;
    }
    try {
        const customerResult = await pool.query(
            "SELECT customer_id, customer_name, customer_hp FROM customer WHERE customer_id = $1",
            [id],
        );
        if (customerResult.rowCount === 0) {
            res.status(404).json({ message: "Customer not found" });
            return;
        }
        const [pets, totals, history] = await Promise.all([
            pool.query(
                `SELECT pet_id, customer_id, pet_name, pet_type, pet_remark
                 FROM pet WHERE customer_id = $1 ORDER BY pet_name, pet_id`,
                [id],
            ),
            pool.query(
                `SELECT COUNT(*)::integer AS completed_visits,
                        COALESCE(SUM(visit_amount), 0) AS total_spending
                 FROM (
                     SELECT a.appointment_id, COALESCE(SUM(ap.amount), 0) AS visit_amount
                     FROM appointment a
                     LEFT JOIN appointment_pet ap ON ap.appointment_id = a.appointment_id
                     WHERE a.customer_id = $1 AND a.status = 'COMPLETED'
                     GROUP BY a.appointment_id
                 ) visits`,
                [id],
            ),
            pool.query(
                `SELECT a.appointment_id,
                        TO_CHAR(a.appointment_date, 'YYYY-MM-DD') AS appointment_date,
                        a.start_time, a.status,
                        COALESCE(SUM(ap.amount) FILTER (WHERE a.status = 'COMPLETED'), 0) AS amount,
                        COALESCE(json_agg(json_build_object(
                            'pet_name', p.pet_name, 'service_name', s.service_name,
                            'amount', ap.amount
                        ) ORDER BY ap.appointment_pet_id) FILTER (WHERE ap.appointment_pet_id IS NOT NULL), '[]') AS pets
                 FROM appointment a
                 LEFT JOIN appointment_pet ap ON ap.appointment_id = a.appointment_id
                 LEFT JOIN pet p ON p.pet_id = ap.pet_id
                 LEFT JOIN service s ON s.service_id = ap.service_id
                 WHERE a.customer_id = $1
                 GROUP BY a.appointment_id
                 ORDER BY a.appointment_date DESC, a.start_time DESC`,
                [id],
            ),
        ]);
        res.json({
            customer: customerResult.rows[0],
            pets: pets.rows,
            completed_visits: totals.rows[0].completed_visits,
            total_spending: Number(totals.rows[0].total_spending),
            appointment_history: history.rows.map((row) => ({ ...row, amount: Number(row.amount) })),
        });
    } catch (error) {
        logServerError("Error fetching customer overview:", error);
        res.status(500).json({ message: "Failed to load customer overview" });
    }
}

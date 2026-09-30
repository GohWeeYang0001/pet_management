import { Request, Response } from "express";
import { pool } from "../db";
import { isId, isMoney, isText } from "../validation";

function serviceResponse(service: {
    service_id: string;
    service_name: string;
    default_price: string | null;
    is_active?: boolean;
}) {
    return {
        ...service,
        default_price: service.default_price === null ? null : Number(service.default_price),
    };
}

export async function getActiveServices(req: Request, res: Response): Promise<void> {
    const includeInactive = req.query.include_inactive === "true";
    try {
        const result = await pool.query(
            `SELECT service_id, service_name, default_price, is_active
             FROM service WHERE $1::boolean OR is_active = TRUE ORDER BY service_name, service_id`,
            [includeInactive],
        );
        res.json(result.rows.map(serviceResponse));
    } catch (error) {
        console.error("Error fetching services:", error);
        res.status(500).json({ message: "Failed to fetch services" });
    }
}

export async function createService(req: Request, res: Response): Promise<void> {
    const { service_name, default_price } = req.body ?? {};
    if (!isText(service_name, 100) || !isMoney(default_price)) {
        res.status(400).json({ message: "Service name and non-negative default price are required" });
        return;
    }
    try {
        const result = await pool.query(
            `INSERT INTO service (service_name, default_price) VALUES ($1, $2)
             RETURNING service_id, service_name, default_price, is_active`,
            [service_name.trim(), default_price],
        );
        res.status(201).json(serviceResponse(result.rows[0]));
    } catch (error) {
        console.error("Error creating service:", error);
        res.status(500).json({ message: "Failed to create service" });
    }
}

export async function updateService(req: Request, res: Response): Promise<void> {
    const id = req.params.id;
    const { service_name, default_price, is_active } = req.body ?? {};
    if (!isId(id) || !isText(service_name, 100) || !isMoney(default_price) ||
        typeof is_active !== "boolean") {
        res.status(400).json({ message: "Valid service name, price and active setting are required" });
        return;
    }
    try {
        const result = await pool.query(
            `UPDATE service SET service_name = $1, default_price = $2, is_active = $3
             WHERE service_id = $4 RETURNING service_id, service_name, default_price, is_active`,
            [service_name.trim(), default_price, is_active, id],
        );
        if (result.rowCount === 0) {
            res.status(404).json({ message: "Service not found" });
            return;
        }
        res.json(serviceResponse(result.rows[0]));
    } catch (error) {
        console.error("Error updating service:", error);
        res.status(500).json({ message: "Failed to update service" });
    }
}

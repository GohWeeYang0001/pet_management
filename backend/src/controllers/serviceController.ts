import { Request, Response } from "express";
import { pool } from "../db";

export async function getActiveServices(_req: Request, res: Response): Promise<void> {
    try {
        const result = await pool.query(
            `SELECT service_id, service_name, default_price
             FROM service WHERE is_active = TRUE ORDER BY service_name, service_id`,
        );
        res.json(result.rows.map((service: {
            service_id: string;
            service_name: string;
            default_price: string | null;
        }) => ({
            ...service,
            default_price: service.default_price === null ? null : Number(service.default_price),
        })));
    } catch (error) {
        console.error("Error fetching services:", error);
        res.status(500).json({ message: "Failed to fetch services" });
    }
}

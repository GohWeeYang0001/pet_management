import { Request, Response } from "express";
import { pool } from "../db";
import { isMoney, isText } from "../validation";
import { isBusinessId, isServiceKind } from "../business/catalog";
import { BusinessError, businessFailure } from "../business/errors";

const columns = "service_id, service_name, default_price, is_active, service_kind";
function serviceResponse(service: { default_price: string | null; [key: string]: unknown }) {
    return { ...service, default_price: service.default_price === null ? null : Number(service.default_price) };
}

export async function getActiveServices(req: Request, res: Response): Promise<void> {
    const kind = req.query.service_kind;
    if (kind !== undefined && !isServiceKind(kind)) {
        res.status(400).json({ message: "Invalid service kind" }); return;
    }
    try {
        const result = await pool.query(
            `SELECT ${columns} FROM service
             WHERE ($1::boolean OR is_active = TRUE)
               AND ($2::text IS NULL OR service_kind = $2)
             ORDER BY service_name, service_id`,
            [req.query.include_inactive === "true", kind ?? null],
        );
        res.json(result.rows.map(serviceResponse));
    } catch (error) { businessFailure(res, error, "Error fetching services:"); }
}

export async function createService(req: Request, res: Response): Promise<void> {
    const { service_name, default_price, service_kind = "BASE" } = req.body ?? {};
    if (!isText(service_name, 100) || !isMoney(default_price) || !isServiceKind(service_kind)) {
        res.status(400).json({ message: "Valid name, non-negative price, BASE/ADDON kind are required" }); return;
    }
    try {
        const result = await pool.query(
            `INSERT INTO service (service_name, default_price, service_kind)
             VALUES ($1, $2, $3) RETURNING ${columns}`,
            [service_name.trim(), default_price, service_kind],
        );
        res.status(201).json(serviceResponse(result.rows[0]));
    } catch (error) { businessFailure(res, error, "Error creating service:"); }
}

export async function updateService(req: Request, res: Response): Promise<void> {
    const id = req.params.id;
    const { service_name, default_price, is_active, service_kind } = req.body ?? {};
    if (!isBusinessId(id) || !isText(service_name, 100) || !isMoney(default_price) || typeof is_active !== "boolean"
        || (service_kind !== undefined && !isServiceKind(service_kind))) {
        res.status(400).json({ message: "Valid service name, price, active setting, kind are required" }); return;
    }
    let client;
    try {
        client = await pool.connect();
        await client.query("BEGIN");
        // Booking takes SHARE locks on catalog rows: kind changes cannot race references.
        const found = await client.query("SELECT service_kind FROM service WHERE service_id = $1 FOR UPDATE", [id]);
        if (!found.rowCount) throw new BusinessError(404, "Service not found");
        const kind = service_kind ?? found.rows[0].service_kind;
        if (kind !== found.rows[0].service_kind) {
            const used = await client.query(
                `SELECT EXISTS(SELECT 1 FROM appointment_pet WHERE service_id = $1)
                     OR EXISTS(SELECT 1 FROM appointment_pet_addon WHERE service_id = $1) AS referenced`, [id],
            );
            if (used.rows[0].referenced) throw new BusinessError(409, "Referenced services cannot change BASE/ADDON kind");
        }
        const result = await client.query(
            `UPDATE service SET service_name = $1, default_price = $2, is_active = $3,
                 service_kind = $4 WHERE service_id = $5 RETURNING ${columns}`,
            [service_name.trim(), default_price, is_active, kind, id],
        );
        await client.query("COMMIT");
        res.json(serviceResponse(result.rows[0]));
    } catch (error) {
        if (client) await client.query("ROLLBACK");
        businessFailure(res, error, "Error updating service:");
    } finally { client?.release(); }
}

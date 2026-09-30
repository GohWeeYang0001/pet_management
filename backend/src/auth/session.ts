import { createHmac, randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import { pool } from "../db";
import { authConfig } from "./config";

export interface AuthUser { user_id: string; username: string; role: "ADMIN" | "EMPLOYEE" }

export function setSessionCookie(res: Response, token: string, expiresAt: Date): void {
    // Use the database deadline directly; Express recomputes Expires when maxAge is supplied.
    res.cookie(authConfig.cookieName, token, { ...authConfig.cookie, expires: expiresAt });
}

export function sessionHash(token: string): string {
    return createHmac("sha256", authConfig.secret).update(token).digest("hex");
}

export function cookieToken(req: Request): string | null {
    const cookies: unknown = req.cookies;
    const token = cookies && typeof cookies === "object"
        ? (cookies as Record<string, unknown>)[authConfig.cookieName] : undefined;
    return typeof token === "string" && /^[a-f0-9]{64}$/.test(token) ? token : null;
}

export async function revokeSession(req: Request): Promise<void> {
    const token = cookieToken(req);
    if (token) await pool.query("DELETE FROM app_session WHERE token_hash = $1", [sessionHash(token)]);
}

export async function createSession(req: Request, res: Response, userId: string): Promise<void> {
    const token = randomBytes(32).toString("hex");
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const oldToken = cookieToken(req);
        if (oldToken) await client.query("DELETE FROM app_session WHERE token_hash = $1", [sessionHash(oldToken)]);
        await client.query("DELETE FROM app_session WHERE expires_at <= CURRENT_TIMESTAMP");
        const result = await client.query<{ expires_at: Date }>(
            `INSERT INTO app_session (token_hash, user_id, expires_at)
             VALUES ($1, $2, CURRENT_TIMESTAMP + $3::double precision * INTERVAL '1 millisecond')
             RETURNING expires_at`,
            [sessionHash(token), userId, authConfig.sessionMs]);
        await client.query("COMMIT");
        setSessionCookie(res, token, result.rows[0].expires_at);
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally { client.release(); }
}

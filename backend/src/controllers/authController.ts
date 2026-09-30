import type { Request, Response } from "express";
import { pool } from "../db";
import { comparePassword, dummyPasswordHash } from "../auth/password";
import { createSession, revokeSession } from "../auth/session";
import { authConfig } from "../auth/config";

const invalidCredentials = { message: "Invalid username or password." };

export async function login(req: Request, res: Response): Promise<void> {
    const { username, password } = req.body ?? {};
    if (typeof username !== "string" || !username.trim() || username.trim().length > 100 ||
        typeof password !== "string" || !password || Buffer.byteLength(password, "utf8") > 72) {
        res.status(400).json({ message: "Enter a valid username and password." }); return;
    }
    try {
        const result = await pool.query<{
            user_id: string; username: string; role: "ADMIN" | "EMPLOYEE"; password_hash: string; is_active: boolean;
        }>("SELECT user_id, username, role, password_hash, is_active FROM app_user WHERE LOWER(username) = LOWER($1)", [username.trim()]);
        const user = result.rows[0];
        const matches = await comparePassword(password, user?.is_active ? user.password_hash : await dummyPasswordHash);
        if (!user?.is_active || !matches) { res.status(401).json(invalidCredentials); return; }
        await createSession(req, res, user.user_id);
        res.json({ user_id: user.user_id, username: user.username, role: user.role });
    } catch {
        console.error("Login could not be processed.");
        res.status(503).json({ message: "Login is temporarily unavailable. Please try again." });
    }
}

export async function logout(req: Request, res: Response): Promise<void> {
    try {
        await revokeSession(req);
        res.clearCookie(authConfig.cookieName, authConfig.cookie);
        res.json({ message: "Logged out." });
    } catch {
        console.error("Logout could not be processed.");
        res.status(503).json({ message: "Could not log out. Please try again." });
    }
}

export function currentUser(_req: Request, res: Response): void {
    res.json(res.locals.authUser);
}

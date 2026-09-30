import type { Request, Response, NextFunction } from "express";
import { pool } from "../db";
import { cookieToken, sessionHash, setSessionCookie, type AuthUser } from "../auth/session";
import { authConfig } from "../auth/config";

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    const token = cookieToken(req);
    if (!token) { res.status(401).json({ message: "Authentication required." }); return; }
    try {
        // UPDATE (never upsert) makes validation/renewal atomic and cannot revive a revoked row.
        const result = await pool.query<AuthUser & { expires_at: Date }>(
            `UPDATE app_session s
             SET expires_at = LEAST(
                 clock_timestamp() + $2::double precision * INTERVAL '1 millisecond',
                 s.created_at + $3::double precision * INTERVAL '1 millisecond')
             FROM app_user u
             WHERE u.user_id = s.user_id AND s.token_hash = $1
                 AND s.expires_at > clock_timestamp()
                 AND s.created_at + $3::double precision * INTERVAL '1 millisecond' > clock_timestamp()
                 AND u.is_active = TRUE
             RETURNING u.user_id, u.username, u.role, s.expires_at`,
            [sessionHash(token), authConfig.sessionMs, authConfig.absoluteSessionMs],
        );
        if (!result.rows[0]) {
            res.clearCookie(authConfig.cookieName, authConfig.cookie);
            res.status(401).json({ message: "Authentication required." }); return;
        }
        const { expires_at, ...user } = result.rows[0];
        setSessionCookie(res, token, expires_at);
        res.locals.authUser = user;
        next();
    } catch {
        console.error("Session verification failed.");
        res.status(503).json({ message: "Unable to verify your session. Please try again." });
    }
}

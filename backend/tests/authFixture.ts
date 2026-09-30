import { randomBytes } from "node:crypto";
import { pool } from "../src/db";
import { hashPassword } from "../src/auth/password";

export const baseUrl = "http://localhost:3000";
export const requestHeader = { "X-Pet-Management-Request": "1" };

export async function createTestUser(active = true, role: "ADMIN" | "EMPLOYEE" = "ADMIN") {
    const username = `auth-qa-${randomBytes(10).toString("hex")}`;
    const password = randomBytes(24).toString("base64url");
    const result = await pool.query<{ user_id: string }>(
        "INSERT INTO app_user (username, password_hash, role, is_active) VALUES ($1, $2, $3, $4) RETURNING user_id",
        [username, await hashPassword(password), role, active],
    );
    const id = result.rows[0].user_id;
    return {
        id, username, password,
        async cleanup() {
            const deleted = await pool.query("DELETE FROM app_user WHERE user_id = $1 AND username = $2 RETURNING user_id", [id, username]);
            if (deleted.rowCount !== 1) throw new Error("QA user marker did not match; cleanup stopped");
        },
    };
}

export async function loginTestUser(user: { username: string; password: string }): Promise<string> {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST", headers: { ...requestHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ username: user.username, password: user.password }),
    });
    if (!response.ok) throw new Error(`QA login failed with HTTP ${response.status}`);
    const cookie = response.headers.get("set-cookie")?.split(";")[0];
    if (!cookie) throw new Error("QA login did not create a session");
    return cookie;
}

export function withSession(cookie: string, init: RequestInit = {}): RequestInit {
    const headers = new Headers(init.headers);
    headers.set("Cookie", cookie);
    headers.set("X-Pet-Management-Request", "1");
    return { ...init, headers };
}

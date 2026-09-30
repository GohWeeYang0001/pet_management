import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { pool } from "../src/db";
import { authConfig } from "../src/auth/config";
import { sessionHash } from "../src/auth/session";
import { baseUrl, createTestUser, loginTestUser, requestHeader, withSession } from "./authFixture";

function assertPublicUser(body: unknown): void {
    assert.ok(body && typeof body === "object");
    assert.deepEqual(Object.keys(body).sort(), ["role", "user_id", "username"]);
}

function cookieHash(cookie: string): string {
    return sessionHash(cookie.slice(cookie.indexOf("=") + 1));
}

async function sessionRow(cookie: string) {
    const result = await pool.query<{ created_at: Date; expires_at: Date; now: Date }>(
        "SELECT created_at, expires_at, clock_timestamp() AS now FROM app_session WHERE token_hash = $1",
        [cookieHash(cookie)]);
    assert.equal(result.rowCount, 1);
    return result.rows[0];
}

function assertCookieDeadline(response: Response, deadline: Date): void {
    const header = response.headers.get("set-cookie") ?? "";
    assert.match(header, /HttpOnly/i);
    assert.match(header, /SameSite=Lax/i);
    assert.match(header, /Path=\//i);
    const expires = /Expires=([^;]+)/i.exec(header);
    assert.ok(expires);
    assert.equal(Date.parse(expires[1]), Math.floor(deadline.getTime() / 1000) * 1000);
    assert.doesNotMatch(header, /Max-Age=/i);
    if (process.env.NODE_ENV === "production") {
        assert.match(header, /^__Host-pm_session=/);
        assert.match(header, /Secure/i);
        assert.doesNotMatch(header, /Domain=/i);
    }
}

async function tryLogin(username: string, password: string) {
    return fetch(`${baseUrl}/api/auth/login`, {
        method: "POST", headers: { ...requestHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
    });
}

async function main() {
    const users: Array<Awaited<ReturnType<typeof createTestUser>>> = [];
    try {
        for (const path of ["customers", "appointments", "services", "expenses", "inventory", "reports/monthly?month=2026-10"]) {
            assert.equal((await fetch(`${baseUrl}/api/${path}`)).status, 401);
        }
        assert.equal((await fetch(`${baseUrl}/api/customers`, { method: "POST" })).status, 401);
        assert.equal((await fetch(`${baseUrl}/api/auth/me`)).status, 401);
        const user = await createTestUser(); users.push(user);
        const inactive = await createTestUser(false); users.push(inactive);
        const employee = await createTestUser(true, "EMPLOYEE"); users.push(employee);
        const valid = await tryLogin(user.username.toUpperCase(), user.password);
        assert.equal(valid.status, 200);
        const publicUser = await valid.json(); assertPublicUser(publicUser);
        assert.equal(publicUser.user_id, user.id); assert.equal(publicUser.role, "ADMIN");
        const cookieHeader = valid.headers.get("set-cookie") ?? "";
        assert.match(cookieHeader, /HttpOnly/i); assert.match(cookieHeader, /SameSite=Lax/i);
        if (process.env.NODE_ENV === "production") assert.match(cookieHeader, /Secure/i);
        assert.ok(valid.headers.has("ratelimit"));
        const cookie = cookieHeader.split(";")[0];
        const initial = await sessionRow(cookie);
        assert.equal(initial.expires_at.getTime() - initial.created_at.getTime(), authConfig.sessionMs);
        assert.equal(authConfig.sessionMs, 30 * 24 * 60 * 60 * 1000);
        assert.equal(authConfig.absoluteSessionMs, 90 * 24 * 60 * 60 * 1000);
        assertCookieDeadline(valid, initial.expires_at);
        const databaseHash = await pool.query<{ password_hash: string }>("SELECT password_hash FROM app_user WHERE user_id = $1", [user.id]);
        assert.match(databaseHash.rows[0].password_hash, /^\$2[aby]\$12\$/);
        assert.notEqual(databaseHash.rows[0].password_hash, user.password);
        const badPassword = await tryLogin(user.username, randomBytes(16).toString("hex"));
        const unknown = await tryLogin(`missing-${randomBytes(12).toString("hex")}`, user.password);
        const disabled = await tryLogin(inactive.username, inactive.password);
        for (const response of [badPassword, unknown, disabled]) assert.equal(response.status, 401);
        const generic = { message: "Invalid username or password." };
        assert.deepEqual(await badPassword.json(), generic);
        assert.deepEqual(await unknown.json(), generic);
        assert.deepEqual(await disabled.json(), generic);
        const me = await fetch(`${baseUrl}/api/auth/me`, withSession(cookie));
        assert.equal(me.status, 200); assertPublicUser(await me.json());
        assert.equal((await fetch(`${baseUrl}/api/services`, withSession(cookie))).status, 200);
        assert.equal((await fetch(`${baseUrl}/api/auth/logout`, { method: "POST", headers: { Cookie: cookie } })).status, 403);
        assert.equal((await fetch(`${baseUrl}/api/services`, withSession(cookie, { headers: { Origin: "https://untrusted.example" } }))).status, 403);
        const allowed = await fetch(`${baseUrl}/api/services`, withSession(cookie, { headers: { Origin: authConfig.origins[0] } }));
        assert.equal(allowed.headers.get("access-control-allow-origin"), authConfig.origins[0]);
        assert.equal(allowed.headers.get("access-control-allow-credentials"), "true");
        // Simulate a returning user, without changing the system clock or waiting days.
        await pool.query(`UPDATE app_session SET created_at = CURRENT_TIMESTAMP - INTERVAL '20 days',
            expires_at = CURRENT_TIMESTAMP + INTERVAL '10 days' WHERE token_hash = $1`, [cookieHash(cookie)]);
        const beforeRolling = await sessionRow(cookie);
        const rolling = await fetch(`${baseUrl}/api/auth/me`, withSession(cookie));
        assert.equal(rolling.status, 200); assertPublicUser(await rolling.json());
        const afterRolling = await sessionRow(cookie);
        assert.equal(afterRolling.created_at.getTime(), beforeRolling.created_at.getTime());
        assert.ok(afterRolling.expires_at.getTime() > beforeRolling.expires_at.getTime());
        assert.ok(Math.abs(afterRolling.expires_at.getTime() - afterRolling.now.getTime() - authConfig.sessionMs) < 5000);
        assertCookieDeadline(rolling, afterRolling.expires_at);
        const parallel = await Promise.all([1, 2, 3].map(() => fetch(`${baseUrl}/api/auth/me`, withSession(cookie))));
        for (const response of parallel) assert.equal(response.status, 200);
        assert.equal((await sessionRow(cookie)).created_at.getTime(), beforeRolling.created_at.getTime());
        const out = await fetch(`${baseUrl}/api/auth/logout`, withSession(cookie, { method: "POST" }));
        assert.equal(out.status, 200);
        assert.equal((await pool.query("SELECT 1 FROM app_session WHERE token_hash = $1", [cookieHash(cookie)])).rowCount, 0);
        assert.equal((await fetch(`${baseUrl}/api/services`, withSession(cookie))).status, 401);
        assert.equal((await fetch(`${baseUrl}/api/auth/me`, withSession(cookie))).status, 401);
        const employeeCookie = await loginTestUser(employee);
        assert.equal((await fetch(`${baseUrl}/api/services`, withSession(employeeCookie))).status, 200);
        await pool.query("UPDATE app_user SET is_active = FALSE WHERE user_id = $1", [employee.id]);
        assert.equal((await fetch(`${baseUrl}/api/services`, withSession(employeeCookie))).status, 401);
        const renewed = await loginTestUser(user);
        await pool.query("UPDATE app_session SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 second' WHERE user_id = $1", [user.id]);
        const expiredBefore = await sessionRow(renewed);
        const expired = await fetch(`${baseUrl}/api/services`, withSession(renewed));
        assert.equal(expired.status, 401);
        assert.match(expired.headers.get("set-cookie") ?? "", /Expires=Thu, 01 Jan 1970/i);
        assert.equal((await sessionRow(renewed)).expires_at.getTime(), expiredBefore.expires_at.getTime());
        const cappedCookie = await loginTestUser(user);
        await pool.query(`UPDATE app_session SET created_at = CURRENT_TIMESTAMP - INTERVAL '89 days',
            expires_at = CURRENT_TIMESTAMP + INTERVAL '12 hours' WHERE token_hash = $1`, [cookieHash(cappedCookie)]);
        const capped = await fetch(`${baseUrl}/api/auth/me`, withSession(cappedCookie));
        assert.equal(capped.status, 200); assertPublicUser(await capped.json());
        const cappedRow = await sessionRow(cappedCookie);
        assert.equal(cappedRow.expires_at.getTime(), cappedRow.created_at.getTime() + authConfig.absoluteSessionMs);
        assertCookieDeadline(capped, cappedRow.expires_at);
        // Even a future inactivity deadline cannot bypass the original-login cap.
        await pool.query(`UPDATE app_session SET created_at = CURRENT_TIMESTAMP - INTERVAL '90 days',
            expires_at = CURRENT_TIMESTAMP + INTERVAL '30 days' WHERE token_hash = $1`, [cookieHash(cappedCookie)]);
        const absoluteBefore = await sessionRow(cappedCookie);
        for (const path of ["auth/me", "services"]) {
            const absolute = await fetch(`${baseUrl}/api/${path}`, withSession(cappedCookie));
            assert.equal(absolute.status, 401);
            assert.match(absolute.headers.get("set-cookie") ?? "", /Expires=Thu, 01 Jan 1970/i);
        }
        assert.equal((await sessionRow(cappedCookie)).expires_at.getTime(), absoluteBefore.expires_at.getTime());
        const freshCookie = await loginTestUser(user);
        assert.equal((await fetch(`${baseUrl}/api/auth/me`, withSession(freshCookie))).status, 200);
        console.log("PASS: API protection, login security, cookie deadlines/flags, rolling/concurrent expiry, 90-day cap, logout, CSRF/CORS and deactivation");
    } finally {
        try { for (const user of users) await user.cleanup(); console.log("PASS: only temporary authentication users/sessions removed"); }
        finally { await pool.end(); }
    }
}
main().catch(() => { console.error("Authentication smoke test failed. No credentials were logged."); process.exitCode = 1; });

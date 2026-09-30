import dotenv from "dotenv";
import type { CookieOptions } from "express";

dotenv.config({ quiet: true });

const production = process.env.NODE_ENV === "production";
const secret = process.env.AUTH_SECRET;
if (!secret || secret.length < 32 || secret === "replace-with-a-strong-secret") {
    throw new Error("AUTH_SECRET must contain at least 32 characters. Run npm run setup-auth locally.");
}

const origins = process.env.FRONTEND_ORIGIN?.split(",").map((origin) => origin.trim()).filter(Boolean)
    ?? (production ? [] : ["http://localhost:5173", "http://127.0.0.1:5173"]);
if (!origins.length || origins.some((origin) => {
    try {
        const url = new URL(origin);
        return url.origin !== origin || (production && url.protocol !== "https:") ||
            !["http:", "https:"].includes(url.protocol);
    } catch { return true; }
})) {
    throw new Error("FRONTEND_ORIGIN must list exact frontend origins; production requires HTTPS.");
}

export const authConfig = {
    secret,
    origins,
    cookieName: production ? "__Host-pm_session" : "pm_session",
    sessionMs: 30 * 24 * 60 * 60 * 1000,
    absoluteSessionMs: 90 * 24 * 60 * 60 * 1000,
    cookie: { httpOnly: true, secure: production, sameSite: "lax", path: "/" } satisfies CookieOptions,
};

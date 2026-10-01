import { readFileSync } from "node:fs";
import type { PoolConfig } from "pg";

function integer(value: string | undefined, fallback: number, name: string, maximum: number): number {
    const parsed = value === undefined ? fallback : Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
        throw new Error(`${name} must be a valid positive integer.`);
    }
    return parsed;
}

export function serverConfiguration(env: NodeJS.ProcessEnv = process.env) {
    return {
        port: integer(env.PORT, 3000, "PORT", 65535),
        // Planned path: client -> ALB -> instance nginx -> Express. Never trust all proxies.
        trustProxy: env.NODE_ENV === "production"
            ? integer(env.TRUST_PROXY_HOPS, 2, "TRUST_PROXY_HOPS", 5) : false,
    };
}

export function databaseConfiguration(env: NodeJS.ProcessEnv = process.env): PoolConfig {
    if (env.DB_SSL !== undefined && env.DB_SSL !== "true" && env.DB_SSL !== "false") {
        throw new Error("DB_SSL must be true or false.");
    }
    return {
        host: env.DB_HOST,
        port: integer(env.DB_PORT, 5432, "DB_PORT", 65535),
        user: env.DB_USER,
        password: env.DB_PASSWORD,
        database: env.DB_NAME,
        ssl: env.DB_SSL === "true" ? {
            rejectUnauthorized: true,
            ...(env.DB_SSL_CA_FILE ? { ca: readFileSync(env.DB_SSL_CA_FILE, "utf8") } : {}),
        } : false,
        connectionTimeoutMillis: 10000,
    };
}

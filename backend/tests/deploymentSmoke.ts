import assert from "node:assert/strict";
import express from "express";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { serverConfiguration, databaseConfiguration } from "../src/config/runtime";
import { logServerError } from "../src/logging";
import { authConfig } from "../src/auth/config";

async function main() {
    // These are deployment expectations, not runtime defaults or localhost settings.
    const productionFrontend = "https://admin.petgroom.my";
    const productionApi = "https://api.petgroom.my";
    const repositoryRoot = resolve(__dirname, "../..");
    const backendExample = readFileSync(resolve(repositoryRoot, "backend/.env.example"), "utf8");
    const frontendExample = readFileSync(resolve(repositoryRoot, "frontend/.env.example"), "utf8");
    const deploymentDocumentation = readFileSync(resolve(repositoryRoot, "AWS_DEPLOYMENT.md"), "utf8");
    assert.ok(backendExample.includes(`# FRONTEND_ORIGIN=${productionFrontend}`));
    assert.ok(frontendExample.includes(`VITE_API_BASE_URL=${productionApi}`));
    assert.ok(deploymentDocumentation.includes(`FRONTEND_ORIGIN\` | \`${productionFrontend}`));
    assert.ok(deploymentDocumentation.includes(`VITE_API_BASE_URL=${productionApi}`));
    assert.equal(new URL(productionFrontend).hostname, "admin.petgroom.my");
    assert.equal(new URL(productionApi).hostname, "api.petgroom.my");
    assert.deepEqual(serverConfiguration({}), { port: 3000, trustProxy: false });
    assert.deepEqual(serverConfiguration({ NODE_ENV: "production", PORT: "8080" }), { port: 8080, trustProxy: 2 });
    assert.equal(serverConfiguration({ NODE_ENV: "development", TRUST_PROXY_HOPS: "5" }).trustProxy, false);
    assert.equal(serverConfiguration({ NODE_ENV: "production", TRUST_PROXY_HOPS: "1" }).trustProxy, 1);
    for (const PORT of ["", "zero", "0", "-1", "65536", "1.5"]) assert.throws(() => serverConfiguration({ PORT }));
    for (const TRUST_PROXY_HOPS of ["true", "0", "-1", "6", "1.5"]) {
        assert.throws(() => serverConfiguration({ NODE_ENV: "production", TRUST_PROXY_HOPS }));
    }
    assert.equal(databaseConfiguration({}).ssl, false);
    assert.equal(databaseConfiguration({}).port, 5432);
    assert.deepEqual(databaseConfiguration({ DB_SSL: "true" }).ssl, { rejectUnauthorized: true });
    assert.throws(() => databaseConfiguration({ DB_SSL: "yes" }));
    assert.throws(() => databaseConfiguration({ DB_PORT: "invalid" }));

    // Verify Express ignores forwarded metadata locally and recognizes HTTPS with configured proxies.
    for (const NODE_ENV of ["development", "production"]) {
        const app = express();
        app.set("trust proxy", serverConfiguration({ NODE_ENV }).trustProxy);
        app.get("/", (req, res) => { res.json({ secure: req.secure, ip: req.ip }); });
        const server = app.listen(0, "127.0.0.1");
        await new Promise<void>((resolve) => server.once("listening", resolve));
        try {
            const address = server.address(); assert.ok(address && typeof address !== "string");
            const response = await fetch(`http://127.0.0.1:${address.port}`, {
                headers: { "X-Forwarded-Proto": "https", "X-Forwarded-For": "198.51.100.7, 10.0.0.5" },
            });
            const body = await response.json();
            assert.equal(body.secure, NODE_ENV === "production");
            assert.equal(body.ip, NODE_ENV === "production" ? "198.51.100.7" : "127.0.0.1");
        } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
    }

    const originalLogger = console.error;
    const logs: unknown[][] = [];
    console.error = (...args: unknown[]) => { logs.push(args); };
    try { logServerError("Test failure", { code: "23505", message: "private SQL", detail: "private credential" }); }
    finally { console.error = originalLogger; }
    assert.deepEqual(logs, [["Test failure", { code: "23505" }]]);

    const baseUrl = `http://localhost:${process.env.PORT ?? 3000}`;
    const health = await fetch(`${baseUrl}/api/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: "ok" });
    assert.equal(health.headers.get("x-content-type-options"), "nosniff");
    assert.equal(health.headers.get("cache-control"), "no-store");
    assert.equal(health.headers.get("x-powered-by"), null);
    const allowed = await fetch(`${baseUrl}/api/health`, { headers: { Origin: authConfig.origins[0] } });
    assert.equal(allowed.headers.get("access-control-allow-origin"), authConfig.origins[0]);
    assert.equal(allowed.headers.get("access-control-allow-credentials"), "true");
    const rejected = await fetch(`${baseUrl}/api/health`, { headers: { Origin: "https://untrusted.example" } });
    assert.equal(rejected.status, 403);
    assert.equal(rejected.headers.get("access-control-allow-origin"), null);
    const malformed = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST", headers: { "Content-Type": "application/json", "X-Pet-Management-Request": "1" },
        body: "{invalid-json",
    });
    assert.equal(malformed.status, 400);
    assert.deepEqual(await malformed.json(), { message: "Invalid request body." });
    assert.equal((await fetch(`${baseUrl}/api/customers`)).status, 401);
    console.log("PASS: production domain examples/docs, runtime port/proxy, strict TLS configuration, safe logging, public health, security headers, CORS and sanitized errors");
}

main().catch(() => { console.error("Deployment readiness test failed. No configuration values were logged."); process.exitCode = 1; });

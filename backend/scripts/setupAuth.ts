import { randomBytes } from "node:crypto";
import { appendFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import dotenv from "dotenv";

async function main() {
    if (process.env.NODE_ENV === "production") throw new Error("Configure production secrets through the deployment environment.");
    const path = resolve(process.cwd(), ".env");
    let content = "";
    try { content = await readFile(path, "utf8"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    const existing = process.env.AUTH_SECRET ?? dotenv.parse(content).AUTH_SECRET;
    if (existing) {
        if (existing.length < 32 || existing === "replace-with-a-strong-secret") {
            throw new Error("An invalid AUTH_SECRET already exists. Replace it securely; this script will not overwrite it.");
        }
        console.log("AUTH_SECRET is already configured; nothing changed."); return;
    }
    await appendFile(path, `${content.endsWith("\n") || !content ? "" : "\n"}AUTH_SECRET=${randomBytes(48).toString("hex")}\n`, { mode: 0o600 });
    console.log("Generated AUTH_SECRET in the ignored backend .env. Its value was not displayed.");
}
main().catch(() => { console.error("Could not configure auth. Check backend .env and permissions; no secret was printed."); process.exitCode = 1; });

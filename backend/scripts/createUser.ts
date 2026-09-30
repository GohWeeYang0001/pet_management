import { createInterface, emitKeypressEvents } from "node:readline";
import { pool } from "../src/db";
import { hashPassword, validNewPassword } from "../src/auth/password";

function question(prompt: string): Promise<string> {
    const reader = createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => reader.question(prompt, (value) => { reader.close(); resolve(value.trim()); }));
}

function secret(prompt: string): Promise<string> {
    if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error("Use an interactive terminal so passwords can be entered without echo.");
    process.stdout.write(prompt);
    emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true); process.stdin.resume();
    return new Promise((resolve, reject) => {
        let value = "";
        const finish = () => {
            process.stdin.removeListener("keypress", keypress); process.stdin.setRawMode(false);
            process.stdin.pause(); process.stdout.write("\n");
        };
        function keypress(text: string | undefined, key: { name?: string; ctrl?: boolean }) {
            if (key.ctrl && key.name === "c") { finish(); reject(new Error("Cancelled.")); }
            else if (key.name === "return" || key.name === "enter") { finish(); resolve(value); }
            else if (key.name === "backspace") value = [...value].slice(0, -1).join("");
            else if (text && !key.ctrl && !/[\u0000-\u001f\u007f]/.test(text) && Buffer.byteLength(value + text, "utf8") <= 1024) value += text;
        }
        process.stdin.on("keypress", keypress);
    });
}

async function main() {
    try {
        const username = await question("Username: ");
        if (!username || username.length > 100) throw new Error("Username is required (maximum 100 characters).");
        const role = (await question("Role (ADMIN or EMPLOYEE): ")).toUpperCase();
        if (role !== "ADMIN" && role !== "EMPLOYEE") throw new Error("Role must be ADMIN or EMPLOYEE.");
        const password = await secret("Password (hidden): ");
        if (!validNewPassword(password)) throw new Error("Use at least 12 characters and at most 72 UTF-8 bytes.");
        if (password !== await secret("Confirm password (hidden): ")) throw new Error("Passwords do not match.");
        await pool.query("INSERT INTO app_user (username, password_hash, role) VALUES ($1, $2, $3)",
            [username, await hashPassword(password), role]);
        console.log("User created. You can now log in.");
    } catch (error) {
        const code = (error as { code?: string }).code;
        console.error(code === "23505" ? "That username already exists." :
            error instanceof Error && !code ? error.message : "Could not create user. Check the migration and database connection.");
        process.exitCode = 1;
    } finally { await pool.end(); }
}
void main();

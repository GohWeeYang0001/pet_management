import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

// bcrypt uses at most 72 UTF-8 bytes; reject truncation explicitly.
export function validNewPassword(password: unknown): password is string {
    return typeof password === "string" && password.length >= 12 && Buffer.byteLength(password, "utf8") <= 72;
}

export function hashPassword(password: string): Promise<string> {
    if (!validNewPassword(password)) throw new Error("Use at least 12 characters and at most 72 UTF-8 bytes.");
    return bcrypt.hash(password, 12);
}

export const comparePassword = bcrypt.compare;

// A random dummy hash equalizes password work for unknown and inactive users.
export const dummyPasswordHash = bcrypt.hash(randomBytes(32).toString("hex"), 12);

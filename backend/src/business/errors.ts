import type { Response } from "express";
import { logServerError } from "../logging";

export class BusinessError extends Error {
    constructor(public readonly status: number, message: string) { super(message); }
}

export function businessFailure(res: Response, error: unknown, context: string): void {
    if (error instanceof BusinessError) { res.status(error.status).json({ message: error.message }); return; }
    logServerError(context, error);
    res.status(500).json({ message: "Unable to process this business request" });
}

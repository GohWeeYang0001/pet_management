import type { Response } from "express";
import { logServerError } from "../logging";

export interface FieldError { field: string; message: string }
export class BusinessError extends Error {
    constructor(public readonly status: number, message: string, public readonly code?: string, public readonly fieldErrors?: FieldError[]) { super(message); }
}

export function businessFailure(res: Response, error: unknown, context: string): void {
    if (error instanceof BusinessError) { res.status(error.status).json({ message: error.message,code:error.code,field_errors:error.fieldErrors }); return; }
    logServerError(context, error);
    res.status(500).json({ message: "Unable to process this business request" });
}

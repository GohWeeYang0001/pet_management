import type { Request, Response, NextFunction } from "express";
import { authConfig } from "../auth/config";

export function requestSecurity(req: Request, res: Response, next: NextFunction): void {
    res.setHeader("Cache-Control", "no-store");
    const origin = req.get("Origin");
    if (origin && !authConfig.origins.includes(origin)) {
        res.status(403).json({ message: "Request origin is not allowed." }); return;
    }
    next();
}

export function requireRequestHeader(req: Request, res: Response, next: NextFunction): void {
    // A custom header forces cross-origin browsers through the allowlisted CORS preflight.
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.get("X-Pet-Management-Request") !== "1") {
        res.status(403).json({ message: "Invalid request. Please use the application." }); return;
    }
    next();
}

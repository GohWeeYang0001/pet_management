import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import authRoutes from "./routes/authRoutes";
import { authConfig } from "./auth/config";
import { requireAuth } from "./middleware/requireAuth";
import { requestSecurity, requireRequestHeader } from "./middleware/requestSecurity";
import { serverConfiguration } from "./config/runtime";
import { logServerError } from "./logging";

import customerRoutes from "./routes/customerRoutes";
import appointmentRoutes from "./routes/appointmentRoutes";
import serviceRoutes from "./routes/serviceRoutes";
import reportRoutes from "./routes/reportRoutes";
import expenseRoutes from "./routes/expenseRoutes";
import inventoryRoutes from "./routes/inventoryRoutes";
import travelFeeRoutes from "./routes/travelFeeRoutes";


const app = express();
const configuration = serverConfiguration();
app.set("trust proxy", configuration.trustProxy);

app.disable("x-powered-by");
app.use(helmet());
app.use("/api", requestSecurity);
app.use(cors({
    origin: authConfig.origins, credentials: true,
    allowedHeaders: ["Content-Type", "X-Pet-Management-Request"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
}));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

// Liveness only: intentionally does not query PostgreSQL or expose configuration.
app.get("/api/health", (_req, res) => { res.json({ status: "ok" }); });

app.get("/api/test", (req, res) => {
    res.json({
        message: "Pet Management API is working"
    });
});

app.use("/api/auth", requireRequestHeader, authRoutes);
// All present and future business API routes below this boundary require a session.
app.use("/api", requireAuth);
app.use("/api", requireRequestHeader);
app.use("/api/customers", customerRoutes);

app.use("/api/appointments", appointmentRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/travel-fee-options", travelFeeRoutes);

const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    logServerError("Request processing failed.", error);
    if (res.headersSent) { _next(error); return; }
    const status = typeof error === "object" && error !== null && "status" in error
        ? (error as { status: unknown }).status : undefined;
    res.status(status === 400 || status === 413 ? status : 500).json({
        message: status === 413 ? "Request is too large." : status === 400 ? "Invalid request body." : "Unable to process request.",
    });
};
app.use(errorHandler);

const PORT = configuration.port;

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});

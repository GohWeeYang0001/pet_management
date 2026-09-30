import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import authRoutes from "./routes/authRoutes";
import { authConfig } from "./auth/config";
import { requireAuth } from "./middleware/requireAuth";
import { requestSecurity, requireRequestHeader } from "./middleware/requestSecurity";

import customerRoutes from "./routes/customerRoutes";
import appointmentRoutes from "./routes/appointmentRoutes";
import serviceRoutes from "./routes/serviceRoutes";
import reportRoutes from "./routes/reportRoutes";
import expenseRoutes from "./routes/expenseRoutes";
import inventoryRoutes from "./routes/inventoryRoutes";


const app = express();

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

const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    const status = typeof error === "object" && error !== null && "status" in error
        ? (error as { status: unknown }).status : undefined;
    res.status(status === 400 || status === 413 ? status : 500).json({
        message: status === 413 ? "Request is too large." : status === 400 ? "Invalid request body." : "Unable to process request.",
    });
};
app.use(errorHandler);

const PORT = 3000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

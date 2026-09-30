import express from "express";
import cors from "cors";

import customerRoutes from "./routes/customerRoutes";
import appointmentRoutes from "./routes/appointmentRoutes";
import serviceRoutes from "./routes/serviceRoutes";
import reportRoutes from "./routes/reportRoutes";
import expenseRoutes from "./routes/expenseRoutes";
import inventoryRoutes from "./routes/inventoryRoutes";


const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/test", (req, res) => {
    res.json({
        message: "Pet Management API is working"
    });
});

app.use("/api/customers", customerRoutes);

app.use("/api/appointments", appointmentRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/inventory", inventoryRoutes);

const PORT = 3000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

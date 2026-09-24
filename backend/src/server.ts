import express from "express";
import cors from "cors";
import { pool } from "./db";

const app = express();

app.use(cors());
app.use(express.json());

// GET endpoint to test if the API is working
app.get("/api/test", (req, res) => {
    res.json({
        message: "Pet Management API is working"
    });
});

// Get查找所有客戶資料
app.get("/api/customers", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                customer_id,
                customer_name,
                customer_hp,
                created_at
            FROM customer
            ORDER BY customer_id
        `);

        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching customers:", error);

        res.status(500).json({
            message: "Internal server error"
        });
    }
});

// 添加新客戶資料
app.post("/api/customers", async (req, res) => {
    const { customer_name, customer_hp } = req.body;

    if (!customer_name || !customer_hp) {
        return res.status(400).json({
            message: "Customer name and phone number are required"
        });
    }

    try {
        const result = await pool.query(
            `
            INSERT INTO customer (
                customer_name,
                customer_hp
            )
            VALUES ($1, $2)
            RETURNING
                customer_id,
                customer_name,
                customer_hp,
                created_at
            `,
            [customer_name, customer_hp]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("Error creating customer:", error);

        res.status(500).json({
            message: "Internal server error"
        });
    }
});


// Get查找特定ID的客戶資料
app.get("/api/customers/:id", async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            `
            SELECT
                customer_id,
                customer_name,
                customer_hp,
                created_at
            FROM customer
            WHERE customer_id = $1
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Customer not found"
            });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Error fetching customer:", error);

        res.status(500).json({
            message: "Internal server error"
        });
    }
});



// 修改特定ID的客戶資料
app.put("/api/customers/:id", async (req, res) => {
    const { id } = req.params;
    const { customer_name, customer_hp } = req.body;

    if (!customer_name || !customer_hp) {
        return res.status(400).json({
            message: "Customer name and phone number are required"
        });
    }

    try {
        const result = await pool.query(
            `
            UPDATE customer
            SET
                customer_name = $1,
                customer_hp = $2
            WHERE customer_id = $3
            RETURNING
                customer_id,
                customer_name,
                customer_hp,
                created_at
            `,
            [customer_name, customer_hp, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Customer not found"
            });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Error updating customer:", error);

        res.status(500).json({
            message: "Internal server error"
        });
    }
});


// GET删除特定ID的客戶資料
app.delete("/api/customers/:id", async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            `
            DELETE FROM customer
            WHERE customer_id = $1
            RETURNING
                customer_id,
                customer_name,
                customer_hp
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Customer not found"
            });
        }

        res.json({
            message: "Customer deleted successfully",
            customer: result.rows[0]
        });
    } catch (error) {
        console.error("Error deleting customer:", error);

        res.status(500).json({
            message: "Internal server error"
        });
    }
});

const PORT = 3000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
import { logServerError } from "../logging";
import { Request, Response } from "express";
import { pool } from "../db";
import { isDateOnly, isId, isMoney, isOptionalText, isText } from "../validation";

const itemColumns = `inventory_item_id, item_name, current_quantity, unit,
    reorder_level, is_active, created_at, updated_at`;

function itemResponse(row: Record<string, unknown>) {
    return {
        ...row,
        current_quantity: Number(row.current_quantity),
        reorder_level: Number(row.reorder_level),
    };
}

export async function getInventory(_req: Request, res: Response): Promise<void> {
    try {
        const result = await pool.query(
            `SELECT ${itemColumns} FROM inventory_item ORDER BY is_active DESC, item_name, inventory_item_id`,
        );
        res.json(result.rows.map(itemResponse));
    } catch (error) {
        logServerError("Error fetching inventory:", error);
        res.status(500).json({ message: "Failed to load inventory" });
    }
}

export async function createInventoryItem(req: Request, res: Response): Promise<void> {
    const { item_name, current_quantity = 0, unit = "unit", reorder_level = 0 } = req.body ?? {};
    if (!isText(item_name, 100) || !isText(unit, 30) ||
        !isMoney(current_quantity) || !isMoney(reorder_level)) {
        res.status(400).json({ message: "Valid item name, unit, quantity and reorder level are required" });
        return;
    }
    try {
        const result = await pool.query(
            `INSERT INTO inventory_item (item_name, current_quantity, unit, reorder_level)
             VALUES ($1, $2, $3, $4) RETURNING ${itemColumns}`,
            [item_name.trim(), current_quantity, unit.trim(), reorder_level],
        );
        res.status(201).json(itemResponse(result.rows[0]));
    } catch (error) {
        logServerError("Error creating inventory item:", error);
        res.status(500).json({ message: "Failed to create inventory item" });
    }
}

export async function updateInventoryItem(req: Request, res: Response): Promise<void> {
    const id = req.params.id;
    const { item_name, unit, reorder_level, is_active } = req.body ?? {};
    if (!isId(id) || !isText(item_name, 100) || !isText(unit, 30) ||
        !isMoney(reorder_level) || typeof is_active !== "boolean") {
        res.status(400).json({ message: "Valid item details are required" });
        return;
    }
    try {
        const result = await pool.query(
            `UPDATE inventory_item SET item_name = $1, unit = $2, reorder_level = $3,
             is_active = $4, updated_at = CURRENT_TIMESTAMP
             WHERE inventory_item_id = $5 RETURNING ${itemColumns}`,
            [item_name.trim(), unit.trim(), reorder_level, is_active, id],
        );
        if (result.rowCount === 0) {
            res.status(404).json({ message: "Inventory item not found" });
            return;
        }
        res.json(itemResponse(result.rows[0]));
    } catch (error) {
        logServerError("Error updating inventory item:", error);
        res.status(500).json({ message: "Failed to update inventory item" });
    }
}

export async function getInventoryTransactions(req: Request, res: Response): Promise<void> {
    const id = req.params.id;
    if (!isId(id)) {
        res.status(400).json({ message: "Invalid inventory item ID" });
        return;
    }
    try {
        const item = await pool.query("SELECT 1 FROM inventory_item WHERE inventory_item_id = $1", [id]);
        if (item.rowCount === 0) {
            res.status(404).json({ message: "Inventory item not found" });
            return;
        }
        const result = await pool.query(
            `SELECT inventory_transaction_id, inventory_item_id, transaction_type,
                    quantity, amount, expense_id, remark, created_at
             FROM inventory_transaction WHERE inventory_item_id = $1
             ORDER BY created_at DESC, inventory_transaction_id DESC LIMIT 30`,
            [id],
        );
        res.json(result.rows.map((row) => ({
            ...row,
            quantity: Number(row.quantity),
            amount: row.amount === null ? null : Number(row.amount),
        })));
    } catch (error) {
        logServerError("Error fetching inventory transactions:", error);
        res.status(500).json({ message: "Failed to load stock history" });
    }
}

export async function stockIn(req: Request, res: Response): Promise<void> {
    const id = req.params.id;
    const { quantity, amount = null, remark, expense_date } = req.body ?? {};
    if (!isId(id) || !isMoney(quantity, true) ||
        (amount !== null && !isMoney(amount)) || !isOptionalText(remark) ||
        (expense_date !== undefined && !isDateOnly(expense_date))) {
        res.status(400).json({ message: "Valid positive quantity, optional cost and date are required" });
        return;
    }
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const item = await client.query(
            "SELECT item_name, is_active FROM inventory_item WHERE inventory_item_id = $1 FOR UPDATE",
            [id],
        );
        if (item.rowCount === 0 || !item.rows[0].is_active) {
            await client.query("ROLLBACK");
            res.status(item.rowCount === 0 ? 404 : 409).json({ message: item.rowCount === 0 ? "Inventory item not found" : "Inactive items cannot be restocked" });
            return;
        }
        let expenseId: string | null = null;
        if (amount !== null) {
            const expense = await client.query(
                `INSERT INTO expense (expense_date, category, item_name, amount, remark, source)
                 VALUES (COALESCE($1::date, CURRENT_DATE), 'INVENTORY', $2, $3, $4, 'INVENTORY')
                 RETURNING expense_id`,
                [expense_date ?? null, item.rows[0].item_name, amount, remark?.trim() || null],
            );
            expenseId = expense.rows[0].expense_id;
        }
        await client.query(
            `INSERT INTO inventory_transaction
             (inventory_item_id, transaction_type, quantity, amount, expense_id, remark)
             VALUES ($1, 'STOCK_IN', $2, $3, $4, $5)`,
            [id, quantity, amount, expenseId, remark?.trim() || null],
        );
        const updated = await client.query(
            `UPDATE inventory_item SET current_quantity = current_quantity + $1,
             updated_at = CURRENT_TIMESTAMP WHERE inventory_item_id = $2 RETURNING ${itemColumns}`,
            [quantity, id],
        );
        await client.query("COMMIT");
        res.json({ item: itemResponse(updated.rows[0]), expense_id: expenseId });
    } catch (error) {
        await client.query("ROLLBACK");
        logServerError("Error stocking in:", error);
        res.status(500).json({ message: "Failed to restock item" });
    } finally {
        client.release();
    }
}

export async function stockOut(req: Request, res: Response): Promise<void> {
    const id = req.params.id;
    const { quantity, remark } = req.body ?? {};
    if (!isId(id) || !isMoney(quantity, true) || !isOptionalText(remark)) {
        res.status(400).json({ message: "A valid positive quantity is required" });
        return;
    }
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const item = await client.query(
            "SELECT current_quantity, is_active FROM inventory_item WHERE inventory_item_id = $1 FOR UPDATE",
            [id],
        );
        if (item.rowCount === 0 || !item.rows[0].is_active) {
            await client.query("ROLLBACK");
            res.status(item.rowCount === 0 ? 404 : 409).json({ message: item.rowCount === 0 ? "Inventory item not found" : "Inactive items cannot be used" });
            return;
        }
        if (Number(item.rows[0].current_quantity) < quantity) {
            await client.query("ROLLBACK");
            res.status(409).json({ message: "Not enough stock available" });
            return;
        }
        await client.query(
            `INSERT INTO inventory_transaction (inventory_item_id, transaction_type, quantity, remark)
             VALUES ($1, 'STOCK_OUT', $2, $3)`,
            [id, quantity, remark?.trim() || null],
        );
        const updated = await client.query(
            `UPDATE inventory_item SET current_quantity = current_quantity - $1,
             updated_at = CURRENT_TIMESTAMP WHERE inventory_item_id = $2 RETURNING ${itemColumns}`,
            [quantity, id],
        );
        await client.query("COMMIT");
        res.json({ item: itemResponse(updated.rows[0]) });
    } catch (error) {
        await client.query("ROLLBACK");
        logServerError("Error stocking out:", error);
        res.status(500).json({ message: "Failed to use stock" });
    } finally {
        client.release();
    }
}

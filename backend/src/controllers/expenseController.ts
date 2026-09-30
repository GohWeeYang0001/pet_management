import { Request, Response } from "express";
import { pool } from "../db";
import { isDateOnly, isId, isMoney, isMonth, isOptionalText, isText } from "../validation";

function validExpense(body: unknown): body is {
    expense_date: string; category: string; item_name: string;
    amount: number; remark?: string | null;
} {
    if (typeof body !== "object" || body === null) return false;
    const row = body as Record<string, unknown>;
    return isDateOnly(row.expense_date) && isText(row.category, 50) &&
        isText(row.item_name, 100) && isMoney(row.amount) && isOptionalText(row.remark);
}

const columns = `expense_id, TO_CHAR(expense_date, 'YYYY-MM-DD') AS expense_date,
    category, item_name, amount, remark, source, created_at`;

export async function getExpenses(req: Request, res: Response): Promise<void> {
    const month = req.query.month;
    if (month !== undefined && !isMonth(month)) {
        res.status(400).json({ message: "Month must use YYYY-MM format" });
        return;
    }
    try {
        const result = await pool.query(
            `SELECT ${columns} FROM expense
             WHERE $1::date IS NULL OR (expense_date >= $1::date
                 AND expense_date < ($1::date + INTERVAL '1 month'))
             ORDER BY expense_date DESC, expense_id DESC`,
            [month ? `${month}-01` : null],
        );
        res.json(result.rows.map((row) => ({ ...row, amount: Number(row.amount) })));
    } catch (error) {
        console.error("Error fetching expenses:", error);
        res.status(500).json({ message: "Failed to load expenses" });
    }
}

export async function createExpense(req: Request, res: Response): Promise<void> {
    if (!validExpense(req.body)) {
        res.status(400).json({ message: "Valid date, category, item and non-negative amount are required" });
        return;
    }
    const { expense_date, category, item_name, amount, remark } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO expense (expense_date, category, item_name, amount, remark, source)
             VALUES ($1, $2, $3, $4, $5, 'MANUAL') RETURNING ${columns}`,
            [expense_date, category.trim(), item_name.trim(), amount, remark?.trim() || null],
        );
        res.status(201).json({ ...result.rows[0], amount: Number(result.rows[0].amount) });
    } catch (error) {
        console.error("Error creating expense:", error);
        res.status(500).json({ message: "Failed to create expense" });
    }
}

export async function updateExpense(req: Request, res: Response): Promise<void> {
    const id = req.params.id;
    if (!isId(id) || !validExpense(req.body)) {
        res.status(400).json({ message: "Valid expense ID, date, category, item and amount are required" });
        return;
    }
    const { expense_date, category, item_name, amount, remark } = req.body;
    try {
        const result = await pool.query(
            `UPDATE expense SET expense_date = $1, category = $2, item_name = $3,
             amount = $4, remark = $5 WHERE expense_id = $6 RETURNING ${columns}`,
            [expense_date, category.trim(), item_name.trim(), amount, remark?.trim() || null, id],
        );
        if (result.rowCount === 0) {
            res.status(404).json({ message: "Expense not found" });
            return;
        }
        res.json({ ...result.rows[0], amount: Number(result.rows[0].amount) });
    } catch (error) {
        console.error("Error updating expense:", error);
        res.status(500).json({ message: "Failed to update expense" });
    }
}

export async function deleteExpense(req: Request, res: Response): Promise<void> {
    const id = req.params.id;
    if (!isId(id)) {
        res.status(400).json({ message: "Invalid expense ID" });
        return;
    }
    try {
        const result = await pool.query("DELETE FROM expense WHERE expense_id = $1 RETURNING expense_id", [id]);
        if (result.rowCount === 0) {
            res.status(404).json({ message: "Expense not found" });
            return;
        }
        res.json({ message: "Expense deleted", expense_id: id });
    } catch (error) {
        console.error("Error deleting expense:", error);
        res.status(500).json({ message: "Failed to delete expense" });
    }
}

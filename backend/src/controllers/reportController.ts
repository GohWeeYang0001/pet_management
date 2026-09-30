import { Request, Response } from "express";
import { pool } from "../db";
import { isMonth } from "../validation";

export async function getMonthlyReport(req: Request, res: Response): Promise<void> {
    const month = req.query.month;
    if (!isMonth(month)) {
        res.status(400).json({ message: "Month must use YYYY-MM format" });
        return;
    }
    const start = `${month}-01`;
    try {
        const [dailyResult, expensesResult] = await Promise.all([
            pool.query(
                `SELECT TO_CHAR(a.appointment_date, 'YYYY-MM-DD') AS date,
                        COALESCE(SUM(ap.amount), 0) AS revenue,
                        COUNT(DISTINCT a.appointment_id)::integer AS completed_appointments
                 FROM appointment a
                 LEFT JOIN appointment_pet ap ON ap.appointment_id = a.appointment_id
                 WHERE a.status = 'COMPLETED'
                   AND a.appointment_date >= $1::date
                   AND a.appointment_date < ($1::date + INTERVAL '1 month')
                 GROUP BY a.appointment_date
                 ORDER BY a.appointment_date`,
                [start],
            ),
            pool.query(
                `SELECT COALESCE(SUM(amount), 0) AS expenses
                 FROM expense WHERE expense_date >= $1::date
                   AND expense_date < ($1::date + INTERVAL '1 month')`,
                [start],
            ),
        ]);
        const daily = dailyResult.rows.map((row: {
            date: string; revenue: string; completed_appointments: number;
        }) => ({
            date: row.date,
            revenue: Number(row.revenue),
            completed_appointments: row.completed_appointments,
        }));
        const revenue = daily.reduce((sum, day) => sum + day.revenue, 0);
        const expenses = Number(expensesResult.rows[0].expenses);
        res.json({
            month, revenue, expenses, net: revenue - expenses,
            completed_appointments: daily.reduce((sum, day) => sum + day.completed_appointments, 0),
            daily,
        });
    } catch (error) {
        console.error("Error creating monthly report:", error);
        res.status(500).json({ message: "Failed to load monthly report" });
    }
}

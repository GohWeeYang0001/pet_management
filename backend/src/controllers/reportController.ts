import { logServerError } from "../logging";
import { Request, Response } from "express";
import { pool } from "../db";
import { isMonth } from "../validation";
import { appointmentChargesCte } from "../business/appointmentQueries";

export async function getMonthlyReport(req: Request,res: Response): Promise<void> {
    const month = req.query.month;
    if (!isMonth(month)) { res.status(400).json({message:"Month must use YYYY-MM format"}); return; }
    try {
        // All arithmetic stays NUMERIC in PostgreSQL until final JSON conversion.
        const result = await pool.query(appointmentChargesCte + `,
            daily_revenue AS (
                SELECT appointment_date,COALESCE(SUM(amount_due),0) AS revenue,
                       COUNT(*)::integer AS completed_appointments
                FROM appointment_charges WHERE status='COMPLETED'
                  AND appointment_date >= $1::date AND appointment_date < ($1::date + INTERVAL '1 month')
                GROUP BY appointment_date
            ), revenue_summary AS (
                SELECT COALESCE(SUM(revenue),0) AS revenue,
                       COALESCE(SUM(completed_appointments),0)::integer AS completed_appointments,
                       COALESCE(json_agg(json_build_object(
                           'date',TO_CHAR(appointment_date,'YYYY-MM-DD'),'revenue',revenue,
                           'completed_appointments',completed_appointments
                       ) ORDER BY appointment_date),'[]') AS daily
                FROM daily_revenue
            ), expense_summary AS (
                SELECT COALESCE(SUM(amount),0) AS expenses FROM expense
                WHERE expense_date >= $1::date AND expense_date < ($1::date + INTERVAL '1 month')
            )
            SELECT r.revenue,e.expenses,r.revenue-e.expenses AS net,r.completed_appointments,r.daily
            FROM revenue_summary r CROSS JOIN expense_summary e`,[month+"-01"]);
        const row=result.rows[0];
        res.json({month,revenue:Number(row.revenue),expenses:Number(row.expenses),net:Number(row.net),
            completed_appointments:row.completed_appointments,daily:row.daily});
    } catch (error) {
        logServerError("Error creating monthly report:",error);
        res.status(500).json({message:"Failed to load monthly report"});
    }
}

import { logServerError } from "../logging";
import { Request, Response } from "express";
import { pool } from "../db";
import { isText } from "../validation";
import { customerManagementColumns,petManagementColumns } from "../business/recordManagement";
import { isBusinessId } from "../business/catalog";
import { customerChargesCte, appointmentPageReadSql, appointmentResponse } from "../business/appointmentQueries";

export async function getCustomers(req: Request,res: Response): Promise<void> {
    const search=typeof req.query.search==="string" ? req.query.search.trim() : "";
    try {
        const result=await pool.query(`SELECT ${customerManagementColumns} FROM customer c
            WHERE ($1='' OR c.customer_name ILIKE '%' || $1 || '%' OR c.customer_hp ILIKE '%' || $1 || '%')
              AND ($2::boolean OR NOT c.is_archived) ORDER BY c.customer_name,c.customer_id`,[search,req.query.include_archived==="true"]);
        res.json(result.rows);
    } catch(error) {logServerError("Error fetching customers:",error);res.status(500).json({message:"Failed to load customers"});}
}
export async function getCustomerById(req: Request,res: Response): Promise<void> {
    if(!isBusinessId(req.params.id)){res.status(400).json({message:"Invalid customer ID"});return;}
    try {
        const result=await pool.query(`SELECT ${customerManagementColumns} FROM customer c WHERE c.customer_id=$1`,[req.params.id]);
        if(!result.rowCount){res.status(404).json({message:"Customer not found"});return;}
        res.json(result.rows[0]);
    } catch(error) {logServerError("Error fetching customer:",error);res.status(500).json({message:"Failed to load customer"});}
}
export async function createCustomer(
    req: Request,
    res: Response
): Promise<void> {
    const { customer_name, customer_hp } = req.body;

    if (!isText(customer_name,100) || !isText(customer_hp,20)) {
        res.status(400).json({
            message: "Customer name and phone number are required"
        });
        return;
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
                created_at, is_archived
            `,
            [customer_name.trim(), customer_hp.trim()]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        logServerError("Error creating customer:", error);

        res.status(500).json({
            message: "Internal server error"
        });
    }
}

export async function updateCustomer(
    req: Request,
    res: Response
): Promise<void> {
    const { id } = req.params;
    if(!isBusinessId(id)){res.status(400).json({message:"Invalid customer ID"});return;}
    const { customer_name, customer_hp } = req.body;

    if (!isText(customer_name,100) || !isText(customer_hp,20)) {
        res.status(400).json({
            message: "Customer name and phone number are required"
        });
        return;
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
                created_at, is_archived
            `,
            [customer_name.trim(), customer_hp.trim(), id]
        );

        if (result.rows.length === 0) {
            res.status(404).json({
                message: "Customer not found"
            });
            return;
        }

        res.json(result.rows[0]);
    } catch (error) {
        logServerError("Error updating customer:", error);

        res.status(500).json({
            message: "Internal server error"
        });
    }
}

export {deleteCustomer} from "./recordManagementController";

export async function getCustomerOverview(req: Request, res: Response): Promise<void> {
    const id = req.params.id;
    if (!isBusinessId(id)) { res.status(400).json({ message: "Invalid customer ID" }); return; }
    try {
        const customerResult = await pool.query(
            `SELECT ${customerManagementColumns} FROM customer c WHERE c.customer_id=$1`,[id],
        );
        if (!customerResult.rowCount) { res.status(404).json({message:"Customer not found"}); return; }
        const [pets,totals] = await Promise.all([
            pool.query(`SELECT ${petManagementColumns} FROM pet p WHERE p.customer_id=$1 ORDER BY p.is_archived,p.pet_name,p.pet_id`,[id]),
            pool.query(customerChargesCte + `
                SELECT COUNT(*)::integer AS completed_visits,COALESCE(SUM(amount_due),0) AS total_spending
                FROM appointment_charges WHERE customer_id=$1 AND status='COMPLETED'`,[id]),
        ]);
        res.json({
            customer:customerResult.rows[0],pets:pets.rows,
            completed_visits:totals.rows[0].completed_visits,total_spending:Number(totals.rows[0].total_spending),
        });
    } catch (error) {
        logServerError("Error fetching customer overview:",error);
        res.status(500).json({message:"Failed to load customer overview"});
    }
}

export async function getCustomerAppointments(req: Request,res: Response): Promise<void> {
    const id=req.params.id;
    const parse = (value: unknown,fallback: number): number | null => value === undefined ? fallback
        : typeof value === "string" && /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
    const limit=parse(req.query.limit,10), offset=parse(req.query.offset,0);
    if (!isBusinessId(id) || limit === null || limit < 1 || limit > 20 || offset === null || offset > 2147483647) {
        res.status(400).json({message:"Use a valid customer, limit 1–20 and nonnegative offset"}); return;
    }
    try {
        if (!(await pool.query("SELECT customer_id FROM customer WHERE customer_id=$1",[id])).rowCount) {
            res.status(404).json({message:"Customer not found"}); return;
        }
        const page=await pool.query<{appointment_id:string}>(
            "SELECT appointment_id FROM appointment WHERE customer_id=$1 ORDER BY appointment_date DESC,start_time DESC,appointment_id DESC LIMIT $2 OFFSET $3",
            [id,limit+1,offset],
        );
        const hasMore=page.rows.length>limit;
        const ids=page.rows.slice(0,limit).map(row=>row.appointment_id);
        const details=ids.length ? (await pool.query(appointmentPageReadSql,[ids])).rows : [];
        res.json({appointments:details.map(appointmentResponse),limit,offset,has_more:hasMore,next_offset:hasMore ? offset+limit : null});
    } catch (error) {
        logServerError("Error fetching customer appointment history:",error);
        res.status(500).json({message:"Failed to load customer appointment history"});
    }
}

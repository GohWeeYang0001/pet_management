import { Request, Response } from "express";
import { pool } from "../db";
import { isMoney, isText } from "../validation";
import { isBusinessId } from "../business/catalog";
import { BusinessError, businessFailure } from "../business/errors";

const columns = "travel_fee_option_id,label,amount,is_active,sort_order,created_at,updated_at";
function response(row: Record<string, unknown>) {
    return { ...row,amount:row.amount === null ? null : Number(row.amount) };
}
export async function getTravelFeeOptions(req: Request,res: Response): Promise<void> {
    try {
        const result = await pool.query(`SELECT ${columns} FROM travel_fee_option
            WHERE ($1::boolean OR is_active=TRUE) ORDER BY sort_order,travel_fee_option_id`,[req.query.include_inactive === "true"]);
        res.json(result.rows.map(response));
    } catch (error) { businessFailure(res,error,"Error fetching travel fee options:"); }
}
async function save(req: Request,res: Response,editing: boolean): Promise<void> {
    const { label,amount,is_active=true,sort_order=0 } = req.body ?? {};
    if ((editing && !isBusinessId(req.params.id)) || !isText(label,100)
        || (amount !== null && !isMoney(amount)) || typeof is_active !== "boolean"
        || !Number.isInteger(sort_order) || sort_order < 0 || sort_order > 1000000) {
        res.status(400).json({message:"Valid label, money (or NULL for manual), active setting and order are required"}); return;
    }
    try {
        const values = [label.trim(),amount,is_active,sort_order];
        const result = editing ? await pool.query(`UPDATE travel_fee_option SET label=$1,amount=$2,is_active=$3,sort_order=$4,
            updated_at=CURRENT_TIMESTAMP WHERE travel_fee_option_id=$5 RETURNING ${columns}`,[...values,req.params.id])
            : await pool.query(`INSERT INTO travel_fee_option(label,amount,is_active,sort_order) VALUES($1,$2,$3,$4) RETURNING ${columns}`,values);
        if (!result.rowCount) throw new BusinessError(404,"Travel fee option not found");
        res.status(editing ? 200 : 201).json(response(result.rows[0]));
    } catch (error) { businessFailure(res,error,"Error saving travel fee option:"); }
}
export async function createTravelFeeOption(req: Request,res: Response): Promise<void> { await save(req,res,false); }
export async function updateTravelFeeOption(req: Request,res: Response): Promise<void> { await save(req,res,true); }

import { Request, Response } from "express";
import { pool } from "../db";
import { isBusinessId } from "../business/catalog";
import { BusinessError, businessFailure } from "../business/errors";
import { customerManagementColumns, petManagementColumns } from "../business/recordManagement";

export async function getCustomerPet(req: Request,res: Response): Promise<void> {
    if (!isBusinessId(req.params.customerId) || !isBusinessId(req.params.petId)) { res.status(400).json({message:"Invalid record ID"}); return; }
    try {
        const found=await pool.query(`SELECT ${petManagementColumns} FROM pet p WHERE p.customer_id=$1 AND p.pet_id=$2`,[req.params.customerId,req.params.petId]);
        if (!found.rowCount) throw new BusinessError(404,"Pet not found");
        res.json(found.rows[0]);
    } catch(error) { businessFailure(res,error,"Error reading pet management state:"); }
}

async function changeRecord(req: Request,res: Response,pet: boolean,archive: boolean): Promise<void> {
    const customerId=pet ? req.params.customerId : req.params.id;
    const petId=req.params.petId;
    if (!isBusinessId(customerId) || (pet && !isBusinessId(petId)) || (archive && typeof req.body?.is_archived !== "boolean")) {
        res.status(400).json({message:"Valid record IDs and archive setting are required"});return;
    }
    let client;
    try {
        client=await pool.connect();await client.query("BEGIN");
        // Booking/owned-record creation locks parent first, then pet. Match that order.
        const parent=await client.query("SELECT customer_id FROM customer WHERE customer_id=$1 "+(pet ? "FOR SHARE" : "FOR UPDATE"),[customerId]);
        if (!parent.rowCount) throw new BusinessError(404,"Customer not found");
        if (pet && !(await client.query("SELECT pet_id FROM pet WHERE customer_id=$1 AND pet_id=$2 FOR UPDATE",[customerId,petId])).rowCount) {
            throw new BusinessError(404,"Pet not found for this customer");
        }
        const meta=pet ? (await client.query(`SELECT ${petManagementColumns} FROM pet p WHERE p.customer_id=$1 AND p.pet_id=$2`,[customerId,petId])).rows[0]
            : (await client.query(`SELECT ${customerManagementColumns} FROM customer c WHERE c.customer_id=$1`,[customerId])).rows[0];
        if (archive) {
            await client.query(pet ? "UPDATE pet SET is_archived=$1 WHERE customer_id=$2 AND pet_id=$3"
                : "UPDATE customer SET is_archived=$1 WHERE customer_id=$2",pet ? [req.body.is_archived,customerId,petId] : [req.body.is_archived,customerId]);
            await client.query("COMMIT");res.json({...meta,is_archived:req.body.is_archived});return;
        }
        if (!meta.can_delete) throw new BusinessError(409,pet ? "该宠物已有预约记录，无法永久删除，请改为归档。" : "该客户已有预约记录或历史引用，无法永久删除，请改为归档。","HAS_HISTORY");
        if (!pet && ((req.body?.expected_pet_count !== undefined && req.body.expected_pet_count !== meta.pet_count)
            || (req.body?.expected_address_count !== undefined && req.body.expected_address_count !== meta.address_count))) {
            throw new BusinessError(409,"客户资料已变化，请重新确认删除。","RECORD_CHANGED");
        }
        // Existing FKs cascade ONLY owned pets/addresses. Never delete appointments.
        await client.query(pet ? "DELETE FROM pet WHERE customer_id=$1 AND pet_id=$2" : "DELETE FROM customer WHERE customer_id=$1",pet ? [customerId,petId] : [customerId]);
        await client.query("COMMIT");res.json({message:"Record deleted",deleted:meta});
    } catch(error) {
        if(client)await client.query("ROLLBACK");
        if (typeof error === "object" && error !== null && "code" in error && error.code === "23503") {
            businessFailure(res,new BusinessError(409,"该记录已有历史引用，无法永久删除，请改为归档。","HAS_HISTORY"),"Blocked record deletion:");
        } else businessFailure(res,error,"Error managing customer/pet:");
    } finally {client?.release();}
}
export async function deleteCustomer(req: Request,res: Response): Promise<void> {await changeRecord(req,res,false,false);}
export async function archiveCustomer(req: Request,res: Response): Promise<void> {await changeRecord(req,res,false,true);}
export async function deleteCustomerPet(req: Request,res: Response): Promise<void> {await changeRecord(req,res,true,false);}
export async function archiveCustomerPet(req: Request,res: Response): Promise<void> {await changeRecord(req,res,true,true);}

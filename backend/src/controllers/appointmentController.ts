import { validateBookingRequired } from "../business/bookingValidation";
import { logServerError } from "../logging";
import { Request, Response } from "express";
import { pool } from "../db";
import { isDateOnly, isMoney, isOptionalText, isTime } from "../validation";
import { isBusinessId } from "../business/catalog";
import { BusinessError, businessFailure } from "../business/errors";
import { appointmentReadSql, appointmentResponse } from "../business/appointmentQueries";
import { bookingExtraKeys, bookingExtras, bookingPets, existingBookingPets, prepareBookingPets, saveBookingPets } from "../business/appointmentBooking";

export async function createAppointment(req: Request, res: Response): Promise<void> {
    const body = req.body ?? {};
    const { customer_id, appointment_date, start_time, remark, status } = body;
    let client;
    try {
        validateBookingRequired(body,false);
        if ((status !== undefined && status !== "CONFIRMED") || !isBusinessId(customer_id)
            || !isDateOnly(appointment_date) || !isTime(start_time) || !isOptionalText(remark)) {
            throw new BusinessError(400, "Customer, date, time and at least one pet are required");
        }
        const rows = bookingPets(body.pets, false);
        client = await pool.connect();
        await client.query("BEGIN");
        const customer = await client.query("SELECT customer_id,is_archived FROM customer WHERE customer_id=$1 FOR SHARE",[customer_id]);
        if (!customer.rowCount) throw new BusinessError(404,"客户不存在，请重新选择","BOOKING_VALIDATION",[{field:"customer",message:"客户不存在，请重新选择"}]);
        if(customer.rows[0].is_archived) throw new BusinessError(409,"该客户已归档，请选择其他客户。","BOOKING_VALIDATION",[{field:"customer",message:"该客户已归档"}]);
        const pets = await prepareBookingPets(client,customer_id,rows);
        const extras = await bookingExtras(client,customer_id,body);
        const inserted = await client.query<{ appointment_id: string }>(
            "INSERT INTO appointment (customer_id,appointment_date,start_time,status,remark," + bookingExtraKeys.join(",") + ") " +
            "VALUES ($1,$2,$3,'CONFIRMED',$4," + bookingExtraKeys.map((_,i)=>"$"+(i+5)).join(",") + ") RETURNING appointment_id",
            [customer_id,appointment_date,start_time,remark?.trim() || null,...bookingExtraKeys.map(key=>extras[key])],
        );
        const id = inserted.rows[0].appointment_id;
        await saveBookingPets(client,id,pets,false);
        await client.query("COMMIT");
        res.status(201).json({message:"Appointment created successfully",appointment_id:id});
    } catch (error) {
        if (client) await client.query("ROLLBACK");
        businessFailure(res,error,"Error creating appointment:");
    } finally { client?.release(); }
}

export async function getAppointments(_req: Request, res: Response): Promise<void> {
    try {
        const result = await pool.query(appointmentReadSql + " ORDER BY a.appointment_date,a.start_time,a.appointment_id");
        res.json(result.rows.map(appointmentResponse));
    } catch (error) { businessFailure(res,error,"Error fetching appointments:"); }
}

export async function getAppointmentById(req: Request, res: Response): Promise<void> {
    if (!isBusinessId(req.params.id)) { res.status(400).json({message:"Invalid appointment ID"}); return; }
    try {
        const result = await pool.query(appointmentReadSql + " WHERE a.appointment_id=$1",[req.params.id]);
        if (!result.rowCount) { res.status(404).json({message:"Appointment not found"}); return; }
        res.json(appointmentResponse(result.rows[0]));
    } catch (error) { businessFailure(res,error,"Error fetching appointment:"); }
}

interface CompletionPet {
    appointment_pet_id: number;
    amount: number;
    remark?: string | null;
}

export async function completeAppointment(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const pets: unknown = req.body?.pets;

    if (!isBusinessId(id) || !Array.isArray(pets) || pets.length === 0) {
        res.status(400).json({ message: "A valid appointment and at least one pet are required" });
        return;
    }

    const validPets = pets.every((pet: unknown) => {
        if (typeof pet !== "object" || pet === null) return false;
        const entry = pet as Partial<CompletionPet>;
        return Number.isSafeInteger(entry.appointment_pet_id) &&
            Number(entry.appointment_pet_id) > 0 &&
            isMoney(entry.amount) &&
            (entry.remark === undefined || entry.remark === null || typeof entry.remark === "string");
    });

    if (!validPets) {
        res.status(400).json({ message: "Each pet needs a valid ID and a non-negative amount with at most two decimal places" });
        return;
    }

    const completionPets = pets as CompletionPet[];
    if (new Set(completionPets.map((pet) => pet.appointment_pet_id)).size !== completionPets.length) {
        res.status(400).json({ message: "Each appointment pet may only be included once" });
        return;
    }

    let client;
    try {
        client = await pool.connect();
        await client.query("BEGIN");

        const appointmentResult = await client.query(
            "SELECT status FROM appointment WHERE appointment_id = $1 FOR UPDATE",
            [id],
        );
        if (appointmentResult.rows.length === 0) {
            await client.query("ROLLBACK");
            res.status(404).json({ message: "Appointment not found" });
            return;
        }
        if (appointmentResult.rows[0].status !== "CONFIRMED") {
            await client.query("ROLLBACK");
            res.status(409).json({ message: "Only confirmed appointments can be completed" });
            return;
        }

        const petResult = await client.query(
            "SELECT appointment_pet_id FROM appointment_pet WHERE appointment_id = $1 FOR UPDATE",
            [id],
        );
        const existingIds = new Set(petResult.rows.map((row: { appointment_pet_id: string }) => String(row.appointment_pet_id)));
        if (completionPets.length !== existingIds.size ||
            completionPets.some((pet) => !existingIds.has(String(pet.appointment_pet_id)))) {
            await client.query("ROLLBACK");
            res.status(400).json({ message: "Amounts are required for every pet in this appointment" });
            return;
        }

        for (const pet of completionPets) {
            await client.query(
                `UPDATE appointment_pet
                 SET amount = $1, remark = $2
                 WHERE appointment_pet_id = $3 AND appointment_id = $4`,
                [pet.amount, pet.remark ?? null, pet.appointment_pet_id, id],
            );
        }

        await client.query(
            `UPDATE appointment
             SET status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP,
                 payment_tracking_started_at = CURRENT_TIMESTAMP
             WHERE appointment_id = $1`,
            [id],
        );
        await client.query("COMMIT");
        res.json({ message: "Appointment completed successfully", appointment_id: id });
    } catch (error) {
        if (client) await client.query("ROLLBACK");
        logServerError("Error completing appointment:", error);
        res.status(500).json({ message: "Failed to complete appointment" });
    } finally {
        client?.release();
    }
}


export async function editAppointment(req: Request, res: Response): Promise<void> {
    const id = req.params.id;
    const body = req.body ?? {};
    const {appointment_date,start_time,remark} = body;
    let client;
    try {
        validateBookingRequired(body,true);
        if (!isBusinessId(id) || !isDateOnly(appointment_date) || !isTime(start_time) || !isOptionalText(remark)) {
            throw new BusinessError(400,"Valid date, time and at least one pet with a service are required");
        }
        const rows = bookingPets(body.pets,true);
        client = await pool.connect();
        await client.query("BEGIN");
        const result = await client.query("SELECT * FROM appointment WHERE appointment_id=$1 FOR UPDATE",[id]);
        if (!result.rowCount) throw new BusinessError(404,"Appointment not found");
        const current = result.rows[0];
        validateBookingRequired(body,true,current);
        if (current.status !== "CONFIRMED") throw new BusinessError(409,"Only confirmed appointments can be edited");
        await client.query("SELECT customer_id FROM customer WHERE customer_id=$1 FOR SHARE",[current.customer_id]);
        const previousPets = await existingBookingPets(client,String(id));
        const pets = await prepareBookingPets(client,current.customer_id,rows,previousPets);
        const extras = await bookingExtras(client,current.customer_id,body,current);
        await client.query(
            "UPDATE appointment SET appointment_date=$1,start_time=$2,remark=$3,updated_at=CURRENT_TIMESTAMP," +
            bookingExtraKeys.map((key,i)=>key+"=$"+(i+4)).join(",") +
            " WHERE appointment_id=$"+(bookingExtraKeys.length+4),
            [appointment_date,start_time,remark?.trim() || null,...bookingExtraKeys.map(key=>extras[key]),id],
        );
        await saveBookingPets(client,String(id),pets,true);
        await client.query("COMMIT");
        res.json({message:"Appointment updated",appointment_id:id});
    } catch (error) {
        if (client) await client.query("ROLLBACK");
        businessFailure(res,error,"Error editing appointment:");
    } finally { client?.release(); }
}

export async function cancelAppointment(req: Request, res: Response): Promise<void> {
    const id = req.params.id;
    if (!isBusinessId(id)) {
        res.status(400).json({ message: "Invalid appointment ID" });
        return;
    }
    try {
        const result = await pool.query(
            `UPDATE appointment SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP
             WHERE appointment_id = $1 AND status = 'CONFIRMED'
             RETURNING appointment_id`,
            [id],
        );
        if (result.rowCount === 1) {
            res.json({ message: "Appointment cancelled", appointment_id: id });
            return;
        }
        const found = await pool.query("SELECT status FROM appointment WHERE appointment_id = $1", [id]);
        res.status(found.rowCount === 0 ? 404 : 409).json({
            message: found.rowCount === 0 ? "Appointment not found" : "Only confirmed appointments can be cancelled",
        });
    } catch (error) {
        logServerError("Error cancelling appointment:", error);
        res.status(500).json({ message: "Failed to cancel appointment" });
    }
}

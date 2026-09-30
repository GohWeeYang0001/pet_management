import { Request, Response } from "express";
import { pool } from "../db";

export async function createAppointment(
    req: Request,
    res: Response
): Promise<void> {

    const {
        customer_id,
        appointment_date,
        start_time,
        remark,
        pets
    } = req.body;

    if (
        !customer_id ||
        !appointment_date ||
        !start_time ||
        !Array.isArray(pets) ||
        pets.length === 0
    ) {
        res.status(400).json({
            message: "Customer, date, time and at least one pet are required"
        });
        return;
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const customerResult = await client.query(
            `
            SELECT customer_id
            FROM customer
            WHERE customer_id = $1
            `,
            [customer_id]
        );

        if (customerResult.rows.length === 0) {
            await client.query("ROLLBACK");

            res.status(404).json({
                message: "Customer not found"
            });
            return;
        }

        const appointmentResult = await client.query(
            `
            INSERT INTO appointment (
                customer_id,
                appointment_date,
                start_time,
                status,
                remark
            )
            VALUES ($1, $2, $3, 'CONFIRMED', $4)
            RETURNING *
            `,
            [
                customer_id,
                appointment_date,
                start_time,
                remark || null
            ]
        );

        const appointment = appointmentResult.rows[0];

        for (const pet of pets) {

            const petResult = await client.query(
                `
                SELECT pet_id
                FROM pet
                WHERE pet_id = $1
                AND customer_id = $2
                `,
                [pet.pet_id, customer_id]
            );

            if (petResult.rows.length === 0) {
                throw new Error(
                    `Pet ${pet.pet_id} does not belong to this customer`
                );
            }

            await client.query(
                `
                INSERT INTO appointment_pet (
                    appointment_id,
                    pet_id,
                    service_id,
                    remark
                )
                VALUES ($1, $2, $3, $4)
                `,
                [
                    appointment.appointment_id,
                    pet.pet_id,
                    pet.service_id,
                    pet.remark || null
                ]
            );
        }

        await client.query("COMMIT");

        res.status(201).json({
            message: "Appointment created successfully",
            appointment_id: appointment.appointment_id
        });

    } catch (error) {

        await client.query("ROLLBACK");

        console.error("Error creating appointment:", error);

        res.status(500).json({
            message: "Failed to create appointment"
        });

    } finally {
        client.release();
    }
}




export async function getAppointments(
    req: Request,
    res: Response
): Promise<void> {

    try {
        const result = await pool.query(`
            SELECT
                a.appointment_id,
                TO_CHAR(a.appointment_date, 'YYYY-MM-DD') AS appointment_date,
                a.start_time,
                a.status,
                a.remark,

                c.customer_id,
                c.customer_name,
                c.customer_hp,

                COALESCE(
                    json_agg(
                        json_build_object(
                            'appointment_pet_id', ap.appointment_pet_id,
                            'pet_id', p.pet_id,
                            'pet_name', p.pet_name,
                            'pet_type', p.pet_type,
                            'service_id', s.service_id,
                            'service_name', s.service_name,
                            'default_price', s.default_price,
                            'amount', ap.amount,
                            'remark', ap.remark
                        )
                    ) FILTER (
                        WHERE ap.appointment_pet_id IS NOT NULL
                    ),
                    '[]'
                ) AS pets

            FROM appointment a

            JOIN customer c
                ON a.customer_id = c.customer_id

            LEFT JOIN appointment_pet ap
                ON a.appointment_id = ap.appointment_id

            LEFT JOIN pet p
                ON ap.pet_id = p.pet_id

            LEFT JOIN service s
                ON ap.service_id = s.service_id

            GROUP BY
                a.appointment_id,
                c.customer_id

            ORDER BY
                a.appointment_date,
                a.start_time
        `);

        res.json(result.rows);

    } catch (error) {

        console.error("Error fetching appointments:", error);

        res.status(500).json({
            message: "Internal server error"
        });
    }
}

interface CompletionPet {
    appointment_pet_id: number;
    amount: number;
    remark?: string | null;
}

export async function completeAppointment(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const pets: unknown = req.body?.pets;

    if (!/^\d+$/.test(String(id)) || !Array.isArray(pets) || pets.length === 0) {
        res.status(400).json({ message: "A valid appointment and at least one pet are required" });
        return;
    }

    const validPets = pets.every((pet: unknown) => {
        if (typeof pet !== "object" || pet === null) return false;
        const entry = pet as Partial<CompletionPet>;
        return Number.isSafeInteger(entry.appointment_pet_id) &&
            Number(entry.appointment_pet_id) > 0 &&
            typeof entry.amount === "number" &&
            Number.isFinite(entry.amount) &&
            entry.amount >= 0 &&
            entry.amount <= 99999999.99 &&
            /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(String(entry.amount)) &&
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
        if (appointmentResult.rows[0].status === "CANCELLED") {
            await client.query("ROLLBACK");
            res.status(409).json({ message: "Cancelled appointments cannot be completed" });
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
             SET status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP
             WHERE appointment_id = $1`,
            [id],
        );
        await client.query("COMMIT");
        res.json({ message: "Appointment completed successfully", appointment_id: id });
    } catch (error) {
        if (client) await client.query("ROLLBACK");
        console.error("Error completing appointment:", error);
        res.status(500).json({ message: "Failed to complete appointment" });
    } finally {
        client?.release();
    }
}

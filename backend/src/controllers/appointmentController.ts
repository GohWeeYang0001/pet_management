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
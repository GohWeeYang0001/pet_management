import { pool } from "../src/db";

const baseUrl = "http://localhost:3000";
const marker = `Codex workflow QA ${Date.now()}`;
let customerId: string | null = null;
let appointmentId: string | null = null;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${baseUrl}${path}`, init);
    if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
    return response.json() as Promise<T>;
}

function json(method: string, body: object): RequestInit {
    return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

async function cleanup(): Promise<void> {
    if (!customerId) return;
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const owned = await client.query(
            "SELECT customer_id FROM customer WHERE customer_id = $1 AND customer_name = $2 FOR UPDATE",
            [customerId, marker],
        );
        if (owned.rowCount !== 1) throw new Error("QA customer marker did not match; cleanup stopped");
        await client.query(
            "DELETE FROM appointment WHERE customer_id = $1",
            [customerId],
        );
        await client.query(
            "DELETE FROM customer WHERE customer_id = $1 AND customer_name = $2",
            [customerId, marker],
        );
        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

async function main(): Promise<void> {
    try {
        const services = await request<Array<{ service_id: string }>>("/api/services");
        if (services.length === 0) throw new Error("No active service is available for the QA workflow");

        const customer = await request<{ customer_id: string }>("/api/customers", json("POST", {
            customer_name: marker,
            customer_hp: "0000000000",
        }));
        customerId = customer.customer_id;

        const petA = await request<{ pet_id: string }>(`/api/customers/${customerId}/pets`, json("POST", {
            pet_name: "QA Pet A", pet_type: "Dog", pet_remark: "Temporary QA record",
        }));
        const petB = await request<{ pet_id: string }>(`/api/customers/${customerId}/pets`, json("POST", {
            pet_name: "QA Pet B", pet_type: "Cat", pet_remark: "Temporary QA record",
        }));
        const customerPets = await request<Array<{ pet_id: string }>>(`/api/customers/${customerId}/pets`);
        if (customerPets.length !== 2) throw new Error("Expected two customer pets");

        const created = await request<{ appointment_id: string }>("/api/appointments", json("POST", {
            customer_id: customerId,
            appointment_date: "2026-10-02",
            start_time: "15:45",
            remark: "Temporary QA appointment",
            pets: [
                { pet_id: petA.pet_id, service_id: services[0].service_id, remark: "A" },
                { pet_id: petB.pet_id, service_id: services[0].service_id, remark: "B" },
            ],
        }));
        appointmentId = created.appointment_id;

        type Appointment = {
            appointment_id: string;
            appointment_date: string;
            status: string;
            pets: Array<{ appointment_pet_id: number; pet_id: number; amount: number | null }>;
        };
        const before = await request<Appointment[]>("/api/appointments");
        const appointment = before.find((item) => String(item.appointment_id) === String(appointmentId));
        if (!appointment || appointment.appointment_date !== "2026-10-02" || appointment.pets.length !== 2) {
            throw new Error("Created appointment or two pet rows were not returned correctly");
        }

        await request(`/api/appointments/${appointmentId}/complete`, json("PATCH", {
            pets: appointment.pets.map((pet, index) => ({
                appointment_pet_id: pet.appointment_pet_id,
                amount: index === 0 ? 120 : 0.29,
                remark: index === 0 ? "A completed" : "B completed",
            })),
        }));

        const after = await request<Appointment[]>("/api/appointments");
        const completed = after.find((item) => String(item.appointment_id) === String(appointmentId));
        const amounts = completed?.pets.map((pet) => Number(pet.amount)).sort((a, b) => a - b);
        if (completed?.status !== "COMPLETED" || !amounts || amounts[0] !== 0.29 || amounts[1] !== 120) {
            throw new Error("Completion status or actual amounts did not persist");
        }
        console.log("PASS: customer, two pets, appointment date, two appointment pets, completion and amounts");
    } finally {
        try {
            await cleanup();
            if (customerId) console.log("PASS: temporary QA records removed");
        } finally {
            await pool.end();
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

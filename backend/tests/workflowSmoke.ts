import { randomUUID } from "node:crypto";
import { pool } from "../src/db";
import { baseUrl, createTestUser, loginTestUser, withSession } from "./authFixture";
const marker = `Codex workflow QA ${randomUUID()}`;
let customerId: string | null = null;
let otherCustomerId: string | null = null;
let appointmentId: string | null = null;
let cancelledAppointmentId: string | null = null;
let expenseId: string | null = null;
const extraExpenseIds: Array<{ id: string; itemName: string }> = [];
let inventoryId: string | null = null;
let serviceId: string | null = null;
let authUser: Awaited<ReturnType<typeof createTestUser>> | null = null;
let sessionCookie = "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${baseUrl}${path}`, withSession(sessionCookie, init));
    if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
    return response.json() as Promise<T>;
}

async function expectStatus(path: string, init: RequestInit, status: number): Promise<void> {
    const response = await fetch(`${baseUrl}${path}`, withSession(sessionCookie, init));
    if (response.status !== status) throw new Error(`${path} returned HTTP ${response.status}, expected ${status}`);
}

function json(method: string, body: object): RequestInit {
    return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

async function cleanup(): Promise<void> {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        if (inventoryId) {
            const owned = await client.query("SELECT inventory_item_id FROM inventory_item WHERE inventory_item_id = $1 AND item_name = $2 FOR UPDATE", [inventoryId, marker]);
            if (owned.rowCount !== 1) throw new Error("QA inventory marker did not match; cleanup stopped");
            const linked = await client.query("SELECT expense_id FROM inventory_transaction WHERE inventory_item_id = $1 AND expense_id IS NOT NULL", [inventoryId]);
            await client.query("DELETE FROM inventory_transaction WHERE inventory_item_id = $1", [inventoryId]);
            await client.query("DELETE FROM inventory_item WHERE inventory_item_id = $1", [inventoryId]);
            for (const row of linked.rows) {
                await client.query("DELETE FROM expense WHERE expense_id = $1 AND source = 'INVENTORY' AND item_name = $2", [row.expense_id, marker]);
            }
        }
        if (expenseId) {
            const owned = await client.query("SELECT expense_id FROM expense WHERE expense_id = $1 AND item_name = $2 FOR UPDATE", [expenseId, marker]);
            if (owned.rowCount !== 1) throw new Error("QA expense marker did not match; cleanup stopped");
            await client.query("DELETE FROM expense WHERE expense_id = $1", [expenseId]);
        }
        for (const extra of extraExpenseIds) {
            const owned = await client.query("SELECT expense_id FROM expense WHERE expense_id = $1 AND item_name = $2 FOR UPDATE", [extra.id, extra.itemName]);
            if (owned.rowCount !== 1) throw new Error("QA category expense marker did not match; cleanup stopped");
            await client.query("DELETE FROM expense WHERE expense_id = $1", [extra.id]);
        }
        if (customerId) {
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
        }
        if (otherCustomerId) {
            const owned = await client.query("SELECT customer_id FROM customer WHERE customer_id = $1 AND customer_name = $2 FOR UPDATE", [otherCustomerId, `${marker} other`]);
            if (owned.rowCount !== 1) throw new Error("QA second customer marker did not match; cleanup stopped");
            await client.query("DELETE FROM customer WHERE customer_id = $1", [otherCustomerId]);
        }
        // Deleting QA appointments above cascades to appointment_pet. Remove their
        // service only afterward, and never delete an unmarked/pre-existing service.
        if (serviceId) {
            const owned = await client.query("SELECT service_id FROM service WHERE service_id = $1 AND service_name = $2 FOR UPDATE", [serviceId, marker]);
            if (owned.rowCount !== 1) throw new Error("QA service marker did not match; cleanup stopped");
            await client.query("DELETE FROM service WHERE service_id = $1 AND service_name = $2", [serviceId, marker]);
        }
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
        authUser = await createTestUser();
        sessionCookie = await loginTestUser(authUser);
        const service = await request<{ service_id: string }>("/api/services", json("POST", {
            service_name: marker, default_price: 10,
        }));
        serviceId = service.service_id;
        const services = await request<Array<{ service_id: string }>>("/api/services");
        if (!services.some((row) => String(row.service_id) === String(serviceId))) {
            throw new Error("Temporary QA service was not returned as active");
        }

        const customer = await request<{ customer_id: string }>("/api/customers", json("POST", {
            customer_name: marker,
            customer_hp: "0000000000",
        }));
        customerId = customer.customer_id;

        const otherCustomer = await request<{ customer_id: string }>("/api/customers", json("POST", {
            customer_name: `${marker} other`, customer_hp: "0000000001",
        }));
        otherCustomerId = otherCustomer.customer_id;

        const petA = await request<{ pet_id: string }>(`/api/customers/${customerId}/pets`, json("POST", {
            pet_name: "QA Pet A", pet_type: "Dog", pet_remark: "Temporary QA record",
        }));
        const petB = await request<{ pet_id: string }>(`/api/customers/${customerId}/pets`, json("POST", {
            pet_name: "QA Pet B", pet_type: "Cat", pet_remark: "Temporary QA record",
        }));
        const customerPets = await request<Array<{ pet_id: string }>>(`/api/customers/${customerId}/pets`);
        if (customerPets.length !== 2) throw new Error("Expected two customer pets");
        await request(`/api/customers/${customerId}/pets/${petA.pet_id}`, json("PUT", {
            pet_name: "QA Pet A edited", pet_type: "Small Dog", pet_remark: "Sensitive skin",
        }));
        const editedPets = await request<Array<{ pet_id: string; pet_name: string; pet_type: string; pet_remark: string }>>(`/api/customers/${customerId}/pets`);
        const editedPet = editedPets.find((pet) => String(pet.pet_id) === String(petA.pet_id));
        if (editedPet?.pet_name !== "QA Pet A edited" || editedPet.pet_type !== "Small Dog" || editedPet.pet_remark !== "Sensitive skin") throw new Error("Pet update did not persist");
        await expectStatus(`/api/customers/${otherCustomerId}/pets/${petA.pet_id}`, json("PUT", {
            pet_name: "Wrong owner", pet_type: "Dog", pet_remark: "",
        }), 404);

        await expectStatus("/api/appointments", json("POST", {
            customer_id: customerId, appointment_date: "2026-10-02", start_time: "15:00", status: "PENDING",
            pets: [{ pet_id: petA.pet_id, service_id: serviceId }],
        }), 400);

        const created = await request<{ appointment_id: string }>("/api/appointments", json("POST", {
            customer_id: customerId,
            appointment_date: "2026-10-02",
            start_time: "15:45",
            remark: "Temporary QA appointment",
            pets: [
                { pet_id: petA.pet_id, service_id: serviceId, remark: "A" },
                { pet_id: petB.pet_id, service_id: serviceId, remark: "B" },
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
        if (!appointment || appointment.appointment_date !== "2026-10-02" || appointment.pets.length !== 2 || appointment.status !== "CONFIRMED") {
            throw new Error("Created appointment or two pet rows were not returned correctly");
        }

        await request(`/api/appointments/${appointmentId}`, json("PATCH", {
            appointment_date: "2026-10-03", start_time: "16:15", remark: "Edited QA appointment",
            pets: appointment.pets.map((pet) => ({ appointment_pet_id: pet.appointment_pet_id,
                pet_id: pet.pet_id, service_id: serviceId, remark: "Edited" })),
        }));
        const edited = (await request<Appointment[]>("/api/appointments"))
            .find((item) => String(item.appointment_id) === String(appointmentId));
        if (edited?.appointment_date !== "2026-10-03" || edited.pets.length !== 2) throw new Error("Appointment edit did not persist");

        const cancelled = await request<{ appointment_id: string }>("/api/appointments", json("POST", {
            customer_id: customerId, appointment_date: "2026-10-03", start_time: "17:15", remark: "Cancel QA",
            pets: [{ pet_id: petA.pet_id, service_id: serviceId, remark: null }],
        }));
        cancelledAppointmentId = cancelled.appointment_id;
        await request(`/api/appointments/${cancelledAppointmentId}/cancel`, { method: "PATCH" });
        const cancelledRow = (await request<Appointment[]>("/api/appointments"))
            .find((item) => String(item.appointment_id) === String(cancelledAppointmentId));
        if (cancelledRow?.status !== "CANCELLED") throw new Error("Confirmed appointment cancel did not persist");

        const baseline = await request<{ revenue: number; expenses: number; net: number; completed_appointments: number }>("/api/reports/monthly?month=2026-10");

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
        await expectStatus(`/api/appointments/${appointmentId}/cancel`, { method: "PATCH" }, 409);
        const overview = await request<{ completed_visits: number; total_spending: number }>(`/api/customers/${customerId}/overview`);
        if (overview.completed_visits !== 1 || overview.total_spending !== 120.29) throw new Error("Customer overview totals incorrect");
        const completedReport = await request<typeof baseline>("/api/reports/monthly?month=2026-10");
        if (Math.abs((completedReport.revenue - baseline.revenue) - 120.29) > 0.001 || completedReport.completed_appointments !== baseline.completed_appointments + 1) throw new Error("Completed-only revenue incorrect");

        const expense = await request<{ expense_id: string }>("/api/expenses", json("POST", {
            expense_date: "2026-10-03", category: "TRANSPORT", item_name: marker, amount: 50, remark: "QA",
        }));
        expenseId = expense.expense_id;
        for (const category of ["TOOLS", "UTILITIES", "MARKETING", "OTHER", "INVENTORY"]) {
            const itemName = `${marker} ${category}`;
            const extra = await request<{ expense_id: string }>("/api/expenses", json("POST", {
                expense_date: "2026-10-03", category, item_name: itemName, amount: 1, remark: "QA category",
            }));
            extraExpenseIds.push({ id: extra.expense_id, itemName });
        }
        await expectStatus("/api/expenses", json("POST", {
            expense_date: "2026-10-03", category: "UNLISTED", item_name: marker, amount: 1,
        }), 400);
        const item = await request<{ inventory_item_id: string }>("/api/inventory", json("POST", {
            item_name: marker, current_quantity: 2, unit: "bottle", reorder_level: 2,
        }));
        inventoryId = item.inventory_item_id;
        await request(`/api/inventory/${inventoryId}/stock-in`, json("POST", {
            quantity: 5, amount: 180, expense_date: "2026-10-03", remark: "QA restock",
        }));
        await request(`/api/inventory/${inventoryId}/stock-out`, json("POST", { quantity: 1, remark: "QA use" }));
        await expectStatus(`/api/inventory/${inventoryId}/stock-out`, json("POST", { quantity: 7, remark: "Too much" }), 409);
        const items = await request<Array<{ inventory_item_id: string; current_quantity: number }>>("/api/inventory");
        if (items.find((row) => String(row.inventory_item_id) === String(inventoryId))?.current_quantity !== 6) throw new Error("Inventory quantity incorrect");
        const transactions = await request<Array<{ transaction_type: string }>>(`/api/inventory/${inventoryId}/transactions`);
        if (transactions.length !== 2) throw new Error("Inventory transactions missing");
        const monthExpenses = await request<Array<{ category: string; source: string; amount: number }>>("/api/expenses?month=2026-10");
        if (!monthExpenses.some((row) => row.category === "INVENTORY" && row.source === "INVENTORY" && Number(row.amount) === 180)) throw new Error("Stock-in did not create an INVENTORY expense");
        const finalReport = await request<typeof baseline>("/api/reports/monthly?month=2026-10");
        if (Math.abs((finalReport.expenses - baseline.expenses) - 235) > 0.001 ||
            Math.abs((finalReport.net - completedReport.net) + 235) > 0.001) throw new Error("Expense/net report incorrect");

        await request(`/api/services/${serviceId}`, json("PUT", { service_name: marker, default_price: 12, is_active: false }));
        const activeServices = await request<Array<{ service_id: string }>>("/api/services");
        if (activeServices.some((row) => String(row.service_id) === String(serviceId))) throw new Error("Inactive service returned by default");
        await expectStatus("/api/appointments", json("POST", {
            customer_id: customerId, appointment_date: "2026-10-04", start_time: "10:00", remark: "Inactive QA",
            pets: [{ pet_id: petA.pet_id, service_id: serviceId, remark: null }],
        }), 400);
        console.log("PASS: confirmed-only appointments, pet add/edit/ownership, six expense categories, calendar data, revenue, inventory, services");
    } finally {
        try {
            await cleanup();
            if (customerId) console.log("PASS: temporary QA records removed");
        } finally {
            try { if (authUser) await authUser.cleanup(); }
            finally { await pool.end(); }
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

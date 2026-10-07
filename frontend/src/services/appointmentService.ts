import type { Appointment, AppointmentExtrasInput } from "../types/appointment";
import { API_BASE_URL, apiFetch, readResponse } from "./api";

export interface NewAppointmentInput extends AppointmentExtrasInput {
    customer_id: string;
    appointment_date: string;
    start_time: string;
    remark: string | null;
    pets: Array<{ pet_id: string; service_id: string; remark: string | null; addons?: Array<{ service_id: string }> }>;
}

export interface CompletionInput {
    pets: Array<{ appointment_pet_id: number; amount: number; remark: string | null }>;
}

export interface EditAppointmentInput extends AppointmentExtrasInput {
    appointment_date: string;
    start_time: string;
    remark: string | null;
    pets: Array<{
        appointment_pet_id?: number;
        pet_id: string;
        service_id: string;
        remark: string | null;
        addons?: Array<{ service_id: string }>;
    }>;
}

export async function getAppointments(): Promise<Appointment[]> {
    const response = await apiFetch(`${API_BASE_URL}/api/appointments`);

    return readResponse<Appointment[]>(response);
}

export async function createAppointment(input: NewAppointmentInput): Promise<void> {
    await readResponse(await apiFetch(`${API_BASE_URL}/api/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    }));
}

export async function completeAppointment(id: string, input: CompletionInput): Promise<void> {
    await readResponse(await apiFetch(`${API_BASE_URL}/api/appointments/${encodeURIComponent(id)}/complete`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    }));
}

export async function editAppointment(id: string, input: EditAppointmentInput): Promise<void> {
    await readResponse(await apiFetch(`${API_BASE_URL}/api/appointments/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    }));
}

export async function cancelAppointment(id: string): Promise<void> {
    await readResponse(await apiFetch(`${API_BASE_URL}/api/appointments/${encodeURIComponent(id)}/cancel`, {
        method: "PATCH",
    }));
}

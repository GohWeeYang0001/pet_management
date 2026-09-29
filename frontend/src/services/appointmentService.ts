import type { Appointment } from "../types/appointment";

const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export async function getAppointments(): Promise<Appointment[]> {
    const response = await fetch(`${API_BASE_URL}/api/appointments`);

    if (!response.ok) {
        throw new Error("Failed to fetch appointments");
    }

    return response.json();
}

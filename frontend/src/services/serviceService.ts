import type { Service } from "../types/service";
import { API_BASE_URL, readResponse } from "./api";

export async function getServices(includeInactive = false): Promise<Service[]> {
    return readResponse<Service[]>(await fetch(`${API_BASE_URL}/api/services${includeInactive ? "?include_inactive=true" : ""}`));
}

export async function createService(service_name: string, default_price: number): Promise<Service> {
    return readResponse<Service>(await fetch(`${API_BASE_URL}/api/services`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service_name, default_price }),
    }));
}

export async function updateService(id: string, service_name: string, default_price: number, is_active: boolean): Promise<Service> {
    return readResponse<Service>(await fetch(`${API_BASE_URL}/api/services/${encodeURIComponent(id)}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service_name, default_price, is_active }),
    }));
}

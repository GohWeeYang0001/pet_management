import type { Service, ServiceInput, ServiceKind } from "../types/service";
import { API_BASE_URL, apiFetch, readResponse } from "./api";

export async function getServices(includeInactive = false, kind?: ServiceKind): Promise<Service[]> {
    const query = new URLSearchParams();
    if (includeInactive) query.set("include_inactive", "true");
    if (kind) query.set("service_kind", kind);
    return readResponse<Service[]>(await apiFetch(`${API_BASE_URL}/api/services?${query}`));
}

export async function createService(input: ServiceInput): Promise<Service> {
    return readResponse<Service>(await apiFetch(`${API_BASE_URL}/api/services`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    }));
}

export async function updateService(id: string, input: ServiceInput & { is_active: boolean }): Promise<Service> {
    return readResponse<Service>(await apiFetch(`${API_BASE_URL}/api/services/${encodeURIComponent(id)}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    }));
}

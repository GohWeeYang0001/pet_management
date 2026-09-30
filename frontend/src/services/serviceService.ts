import type { Service } from "../types/service";
import { API_BASE_URL, readResponse } from "./api";

export async function getServices(): Promise<Service[]> {
    return readResponse<Service[]>(await fetch(`${API_BASE_URL}/api/services`));
}

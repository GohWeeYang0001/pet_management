export const API_BASE_URL =
    (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

export const SESSION_EXPIRED_EVENT = "pet-management-session-expired";

export class ApiError extends Error {
    readonly status: number;
    constructor(status: number) { super(`Request failed with status ${status}`); this.status = status; }
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}, notifyUnauthorized = true): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("X-Pet-Management-Request", "1");
    const response = await fetch(input, { ...init, headers, credentials: "include" });
    if (response.status === 401 && notifyUnauthorized) window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    return response;
}

export async function readResponse<T>(response: Response): Promise<T> {
    if (!response.ok) throw new ApiError(response.status);
    return response.json() as Promise<T>;
}

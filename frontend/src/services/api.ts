export const API_BASE_URL =
    (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

export const SESSION_EXPIRED_EVENT = "pet-management-session-expired";

export class ApiError extends Error {
    readonly status: number;
    readonly code?:string;
    readonly fieldErrors?:Array<{field:string;message:string}>;
    constructor(status: number,code?:string,fieldErrors?:Array<{field:string;message:string}>) { super(`Request failed with status ${status}`); this.status = status;this.code=code;this.fieldErrors=fieldErrors; }
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}, notifyUnauthorized = true): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("X-Pet-Management-Request", "1");
    const response = await fetch(input, { ...init, headers, credentials: "include" });
    if (response.status === 401 && notifyUnauthorized) window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    return response;
}

export async function readResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        let details:unknown;try {details=await response.json();}catch { /* Non-JSON errors keep a safe generic fallback. */ }
        const value=details as {code?:unknown;field_errors?:unknown}|undefined;
        const fields=Array.isArray(value?.field_errors)?value.field_errors.filter((field:unknown):field is {field:string;message:string}=>!!field && typeof field==="object" && "field" in field && "message" in field && typeof field.field==="string" && typeof field.message==="string").slice(0,30):undefined;
        throw new ApiError(response.status,typeof value?.code==="string"?value.code:undefined,fields);
    }
    return response.json() as Promise<T>;
}

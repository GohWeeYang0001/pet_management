import { API_BASE_URL, apiFetch, readResponse } from "./api";
import type { AuthUser } from "../types/auth";

export async function getCurrentUser(): Promise<AuthUser | null> {
    const response = await apiFetch(`${API_BASE_URL}/api/auth/me`, {}, false);
    return response.status === 401 ? null : readResponse<AuthUser>(response);
}

export async function login(username: string, password: string): Promise<AuthUser> {
    return readResponse<AuthUser>(await apiFetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }),
    }, false));
}

export async function logout(): Promise<void> {
    await readResponse(await apiFetch(`${API_BASE_URL}/api/auth/logout`, { method: "POST" }, false));
}

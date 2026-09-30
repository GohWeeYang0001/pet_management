export const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export async function readResponse<T>(response: Response): Promise<T> {
    if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
    return response.json() as Promise<T>;
}

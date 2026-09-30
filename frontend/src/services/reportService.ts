import type { MonthlyReport } from "../types/report";
import { API_BASE_URL, apiFetch, readResponse } from "./api";

export async function getMonthlyReport(month: string): Promise<MonthlyReport> {
    return readResponse<MonthlyReport>(await apiFetch(`${API_BASE_URL}/api/reports/monthly?month=${encodeURIComponent(month)}`));
}

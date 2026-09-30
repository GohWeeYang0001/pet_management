export interface MonthlyReport {
    month: string;
    revenue: number;
    expenses: number;
    net: number;
    completed_appointments: number;
    daily: Array<{ date: string; revenue: number; completed_appointments: number }>;
}

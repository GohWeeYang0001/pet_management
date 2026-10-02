export function currentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(month: string, offset: number): string {
    const [year, monthNumber] = month.split("-").map(Number);
    const index = year * 12 + (monthNumber - 1) + offset;
    const nextYear = Math.floor(index / 12);
    const nextMonth = (index % 12) + 1;
    return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

export function monthTitle(month: string): string {
    const [year, monthNumber] = month.split("-").map(Number);
    return `${year}年${Number(monthNumber)}月`;
}

export function todayDateOnly(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

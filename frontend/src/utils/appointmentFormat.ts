export function formatAppointmentDate(date: string): string {
    const [year, month, day] = date.split("-");
    return `${year}年${Number(month)}月${Number(day)}日`;
}

export function formatAppointmentTime(time: string): string {
    const [rawHour, minute] = time.split(":");
    const hour = Number(rawHour);
    return `${hour >= 12 ? "下午" : "上午"} ${hour % 12 || 12}:${minute}`;
}

export function formatMoney(amount: number | string | null): string {
    if (amount === null) return "未设置";
    return `RM${Number(amount).toFixed(2)}`;
}

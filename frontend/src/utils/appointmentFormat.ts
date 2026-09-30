export function formatAppointmentDate(date: string): string {
    const [year, month, day] = date.split("-");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${Number(day)} ${months[Number(month) - 1]} ${year}`;
}

export function formatAppointmentTime(time: string): string {
    const [rawHour, minute] = time.split(":");
    const hour = Number(rawHour);
    return `${hour % 12 || 12}:${minute} ${hour >= 12 ? "PM" : "AM"}`;
}

export function formatMoney(amount: number | string | null): string {
    if (amount === null) return "Not set";
    return `RM${Number(amount).toFixed(2)}`;
}

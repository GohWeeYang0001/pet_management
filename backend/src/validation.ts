export function isId(value: unknown): value is string | number {
    return (typeof value === "string" && /^[1-9]\d*$/.test(value)) ||
        (typeof value === "number" && Number.isSafeInteger(value) && value > 0);
}

export function isDateOnly(value: unknown): value is string {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    if (month < 1 || month > 12 || day < 1) return false;
    const days = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28,
        31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return day <= days[month - 1];
}

export function isMonth(value: unknown): value is string {
    return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function isMoney(value: unknown, positive = false): value is number {
    return typeof value === "number" && Number.isFinite(value) &&
        (positive ? value > 0 : value >= 0) && value <= 99999999.99 &&
        /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(String(value));
}

export function isText(value: unknown, max: number, required = true): value is string {
    return typeof value === "string" && value.trim().length <= max &&
        (!required || value.trim().length > 0);
}

export function isOptionalText(value: unknown): value is string | null | undefined {
    return value == null || typeof value === "string";
}

export function isTime(value: unknown): value is string {
    return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value);
}

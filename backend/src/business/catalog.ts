import { isId } from "../validation";

export type ServiceKind = "BASE" | "ADDON";
export function isServiceKind(value: unknown): value is ServiceKind { return value === "BASE" || value === "ADDON"; }
export function isBusinessId(value: unknown): value is string | number {
    return isId(value) && BigInt(value) <= 9223372036854775807n;
}

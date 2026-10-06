import { BusinessError } from "./errors";

// Catalog NUMERIC values arrive as decimal strings. Add quote components in cents,
// not floating point; quote storage is bounded by NUMERIC(10,2).
export function quotedPetAmount(base: string | null, addons: string[]): string | null {
    if (base === null) return null; // An unknown legacy catalog price is not zero.
    const cents = [base, ...addons].reduce((sum, price) => {
        if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(price)) throw new BusinessError(400, "Selected services need valid non-negative prices");
        const [whole, fraction = ""] = price.split(".");
        return sum + BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
    }, 0n);
    if (cents > 9999999999n) throw new BusinessError(400, "The pet quote exceeds the supported maximum amount");
    return `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
}

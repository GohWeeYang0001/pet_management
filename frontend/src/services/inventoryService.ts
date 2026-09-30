import type { InventoryItem, InventoryTransaction } from "../types/inventory";
import { API_BASE_URL, readResponse } from "./api";

const jsonHeaders = { "Content-Type": "application/json" };
const itemUrl = (id: string) => `${API_BASE_URL}/api/inventory/${encodeURIComponent(id)}`;

export async function getInventory(): Promise<InventoryItem[]> {
    return readResponse<InventoryItem[]>(await fetch(`${API_BASE_URL}/api/inventory`));
}

export async function getInventoryTransactions(id: string): Promise<InventoryTransaction[]> {
    return readResponse<InventoryTransaction[]>(await fetch(`${itemUrl(id)}/transactions`));
}

export async function createInventoryItem(input: {
    item_name: string; current_quantity: number; unit: string; reorder_level: number;
}): Promise<InventoryItem> {
    return readResponse<InventoryItem>(await fetch(`${API_BASE_URL}/api/inventory`, {
        method: "POST", headers: jsonHeaders, body: JSON.stringify(input),
    }));
}

export async function updateInventoryItem(id: string, input: {
    item_name: string; unit: string; reorder_level: number; is_active: boolean;
}): Promise<InventoryItem> {
    return readResponse<InventoryItem>(await fetch(itemUrl(id), {
        method: "PUT", headers: jsonHeaders, body: JSON.stringify(input),
    }));
}

export async function stockIn(id: string, input: {
    quantity: number; amount: number | null; remark: string | null; expense_date: string;
}): Promise<void> {
    await readResponse(await fetch(`${itemUrl(id)}/stock-in`, {
        method: "POST", headers: jsonHeaders, body: JSON.stringify(input),
    }));
}

export async function stockOut(id: string, input: { quantity: number; remark: string | null }): Promise<void> {
    await readResponse(await fetch(`${itemUrl(id)}/stock-out`, {
        method: "POST", headers: jsonHeaders, body: JSON.stringify(input),
    }));
}

import type { Expense, ExpenseInput } from "../types/expense";
import { API_BASE_URL, readResponse } from "./api";

export async function getExpenses(month: string): Promise<Expense[]> {
    return readResponse<Expense[]>(await fetch(`${API_BASE_URL}/api/expenses?month=${encodeURIComponent(month)}`));
}

export async function createExpense(input: ExpenseInput): Promise<Expense> {
    return readResponse<Expense>(await fetch(`${API_BASE_URL}/api/expenses`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
    }));
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<Expense> {
    return readResponse<Expense>(await fetch(`${API_BASE_URL}/api/expenses/${encodeURIComponent(id)}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
    }));
}

export async function deleteExpense(id: string): Promise<void> {
    await readResponse(await fetch(`${API_BASE_URL}/api/expenses/${encodeURIComponent(id)}`, { method: "DELETE" }));
}

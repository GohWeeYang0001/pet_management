import type { Customer } from "../types/customer";
import { API_BASE_URL, readResponse } from "./api";

export async function getCustomers(): Promise<Customer[]> {
    return readResponse<Customer[]>(await fetch(`${API_BASE_URL}/api/customers`));
}

export async function createCustomer(customer_name: string, customer_hp: string): Promise<Customer> {
    return readResponse<Customer>(await fetch(`${API_BASE_URL}/api/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_name, customer_hp }),
    }));
}

import type { Customer, CustomerOverview } from "../types/customer";
import { API_BASE_URL, apiFetch, readResponse } from "./api";

export async function getCustomers(search = ""): Promise<Customer[]> {
    const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
    return readResponse<Customer[]>(await apiFetch(`${API_BASE_URL}/api/customers${query}`));
}

export async function getCustomerOverview(id: string): Promise<CustomerOverview> {
    return readResponse<CustomerOverview>(await apiFetch(`${API_BASE_URL}/api/customers/${encodeURIComponent(id)}/overview`));
}

export async function createCustomer(customer_name: string, customer_hp: string): Promise<Customer> {
    return readResponse<Customer>(await apiFetch(`${API_BASE_URL}/api/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_name, customer_hp }),
    }));
}

export async function updateCustomer(id: string, customer_name: string, customer_hp: string): Promise<Customer> {
    return readResponse<Customer>(await apiFetch(`${API_BASE_URL}/api/customers/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_name, customer_hp }),
    }));
}

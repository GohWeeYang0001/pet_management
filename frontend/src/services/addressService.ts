import type { AddressInput, CustomerAddress } from "../types/address";
import { API_BASE_URL, apiFetch, readResponse } from "./api";

const path = (customerId: string) => `${API_BASE_URL}/api/customers/${encodeURIComponent(customerId)}/addresses`;

export async function getCustomerAddresses(customerId: string): Promise<CustomerAddress[]> {
    return readResponse<CustomerAddress[]>(await apiFetch(path(customerId)));
}

export async function createCustomerAddress(customerId: string, input: AddressInput): Promise<CustomerAddress> {
    return readResponse<CustomerAddress>(await apiFetch(path(customerId), {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
    }));
}

export async function updateCustomerAddress(customerId: string, id: string, input: AddressInput): Promise<CustomerAddress> {
    return readResponse<CustomerAddress>(await apiFetch(`${path(customerId)}/${encodeURIComponent(id)}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
    }));
}

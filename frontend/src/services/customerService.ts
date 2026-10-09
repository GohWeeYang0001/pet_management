import type { Customer, CustomerOverview, CustomerAppointmentPage } from "../types/customer";
import { API_BASE_URL, apiFetch, readResponse } from "./api";

export async function getCustomers(search = "",includeArchived=false): Promise<Customer[]> {
    const params=new URLSearchParams();if(search.trim())params.set("search",search.trim());if(includeArchived)params.set("include_archived","true");
    const query=params.size?"?"+params.toString():"";
    return readResponse<Customer[]>(await apiFetch(`${API_BASE_URL}/api/customers${query}`));
}

export async function getCustomerOverview(id: string): Promise<CustomerOverview> {
    return readResponse<CustomerOverview>(await apiFetch(`${API_BASE_URL}/api/customers/${encodeURIComponent(id)}/overview`));
}

export async function getCustomerManagementState(id:string):Promise<Customer> {
    return readResponse(await apiFetch(`${API_BASE_URL}/api/customers/${encodeURIComponent(id)}`));
}
export async function deleteCustomer(id:string,petCount:number,addressCount:number):Promise<void> {
    await readResponse(await apiFetch(`${API_BASE_URL}/api/customers/${encodeURIComponent(id)}`,{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({expected_pet_count:petCount,expected_address_count:addressCount})}));
}
export async function setCustomerArchived(id:string,is_archived:boolean):Promise<void> {
    await readResponse(await apiFetch(`${API_BASE_URL}/api/customers/${encodeURIComponent(id)}/archive`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({is_archived})}));
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

export async function getCustomerAppointments(id: string,limit = 10,offset = 0): Promise<CustomerAppointmentPage> {
    return readResponse(await apiFetch(`${API_BASE_URL}/api/customers/${encodeURIComponent(id)}/appointments?limit=${limit}&offset=${offset}`));
}

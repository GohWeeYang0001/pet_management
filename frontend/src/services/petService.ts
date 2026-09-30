import type { Pet } from "../types/pet";
import { API_BASE_URL, apiFetch, readResponse } from "./api";

function petsUrl(customerId: string): string {
    return `${API_BASE_URL}/api/customers/${encodeURIComponent(customerId)}/pets`;
}

export async function getCustomerPets(customerId: string): Promise<Pet[]> {
    return readResponse<Pet[]>(await apiFetch(petsUrl(customerId)));
}

export async function createPet(
    customerId: string,
    pet_name: string,
    pet_type: string,
    pet_remark: string,
): Promise<Pet> {
    return readResponse<Pet>(await apiFetch(petsUrl(customerId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pet_name, pet_type, pet_remark }),
    }));
}

export async function updatePet(
    customerId: string,
    petId: string,
    pet_name: string,
    pet_type: string,
    pet_remark: string,
): Promise<Pet> {
    return readResponse<Pet>(await apiFetch(`${petsUrl(customerId)}/${encodeURIComponent(petId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pet_name, pet_type, pet_remark }),
    }));
}

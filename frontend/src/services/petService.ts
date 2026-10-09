import type { Pet } from "../types/pet";
import { API_BASE_URL, apiFetch, readResponse } from "./api";

function petsUrl(customerId: string): string {
    return `${API_BASE_URL}/api/customers/${encodeURIComponent(customerId)}/pets`;
}

export async function getCustomerPets(customerId: string,includeArchived=false): Promise<Pet[]> {
    return readResponse<Pet[]>(await apiFetch(petsUrl(customerId)+(includeArchived?"?include_archived=true":"")));
}

export async function getPetManagementState(customerId:string,petId:string):Promise<Pet> {
    return readResponse(await apiFetch(`${petsUrl(customerId)}/${encodeURIComponent(petId)}`));
}
export async function deletePet(customerId:string,petId:string):Promise<void> {
    await readResponse(await apiFetch(`${petsUrl(customerId)}/${encodeURIComponent(petId)}`,{method:"DELETE"}));
}
export async function setPetArchived(customerId:string,petId:string,is_archived:boolean):Promise<void> {
    await readResponse(await apiFetch(`${petsUrl(customerId)}/${encodeURIComponent(petId)}/archive`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({is_archived})}));
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

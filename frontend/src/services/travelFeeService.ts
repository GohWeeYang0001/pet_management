import type { TravelFeeOption, TravelFeeOptionInput } from "../types/travelFee";
import { API_BASE_URL, apiFetch, readResponse } from "./api";

const path = API_BASE_URL + "/api/travel-fee-options";
export async function getTravelFeeOptions(includeInactive = false): Promise<TravelFeeOption[]> {
    return readResponse(await apiFetch(path + (includeInactive ? "?include_inactive=true" : "")));
}
export async function createTravelFeeOption(input: TravelFeeOptionInput): Promise<TravelFeeOption> {
    return readResponse(await apiFetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)}));
}
export async function updateTravelFeeOption(id: string,input: TravelFeeOptionInput): Promise<TravelFeeOption> {
    return readResponse(await apiFetch(path+"/"+encodeURIComponent(id),{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)}));
}

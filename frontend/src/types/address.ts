export interface CustomerAddress {
    address_id: string;
    customer_id: string;
    label: string;
    address_text: string | null;
    map_url: string | null;
    latitude: number | null;
    longitude: number | null;
    is_default: boolean;
    is_active: boolean;
}

export interface AddressInput {
    label: string;
    address_text?: string | null;
    map_url?: string | null;
    is_default?: boolean;
    is_active?: boolean;
}

export interface LocationSnapshot {
    label?: string | null;
    address_text?: string | null;
    map_url?: string | null;
    latitude?: number | null;
    longitude?: number | null;
}

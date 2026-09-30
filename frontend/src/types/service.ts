export interface Service {
    service_id: string;
    service_name: string;
    default_price: number | string | null;
    is_active?: boolean;
}

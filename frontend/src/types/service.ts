export type ServiceKind = "BASE" | "ADDON";

export interface Service {
    service_id: string;
    service_name: string;
    default_price: number | null;
    is_active: boolean;
    service_kind: ServiceKind;
}

export type ServiceInput = Pick<Service, "service_name" | "service_kind"> & { default_price: number };

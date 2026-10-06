export interface AppointmentAddon {
    appointment_pet_addon_id: number;
    service_id: number;
    service_name_snapshot: string;
    price_snapshot: number;
}

export interface AppointmentPet {
    appointment_pet_id: number;
    pet_id: number;
    pet_name: string;
    pet_type: string | null;

    service_id: number;
    service_name: string;
    default_price: number | null;
    service_name_snapshot?: string | null;
    base_price_snapshot?: number | null;
    quoted_amount?: number | null;
    addons?: AppointmentAddon[];

    amount: number | null;
    remark: string | null;
}

export type AppointmentStatus =
    | "CONFIRMED"
    | "COMPLETED"
    | "CANCELLED";

export interface Appointment {
    appointment_id: string;
    appointment_date: string;
    start_time: string;
    status: AppointmentStatus;
    remark: string | null;

    customer_id: string;
    customer_name: string;
    customer_hp: string;

    customer_address_id?: string | null;
    address_label_snapshot?: string | null;
    address_text_snapshot?: string | null;
    map_url_snapshot?: string | null;
    latitude_snapshot?: number | null;
    longitude_snapshot?: number | null;
    travel_fee_label?: string | null;
    travel_fee_amount?: number | null;
    travel_fee_note?: string | null;
    quoted_pet_total?: number | null;
    quoted_total?: number | null;
    pet_charges?: number | null;
    amount_due?: number | null;
    payment_tracking_started_at?: string | null;

    pets: AppointmentPet[];
}

export interface AppointmentExtrasInput {
    customer_address_id?: string | null;
    /** Selection validation only; not stored on the appointment. */
    travel_fee_option_id?: string;
    travel_fee_label?: string | null;
    travel_fee_amount?: number | null;
    travel_fee_note?: string | null;
}

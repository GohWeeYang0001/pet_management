export interface Customer {
    customer_id: string;
    customer_name: string;
    customer_hp: string;
    pet_count?: number;
}

export interface CustomerOverview {
    customer: Customer;
    pets: Array<{
        pet_id: string;
        pet_name: string;
        pet_type: string | null;
        pet_remark: string | null;
    }>;
    completed_visits: number;
    total_spending: number;
}
import type { Appointment } from "./appointment";

export interface CustomerAppointmentPage {
    appointments: Appointment[];
    limit: number;
    offset: number;
    has_more: boolean;
    next_offset: number | null;
}

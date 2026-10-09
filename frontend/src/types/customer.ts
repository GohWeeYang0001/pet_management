export interface Customer {
    customer_id: string;
    customer_name: string;
    customer_hp: string;
    pet_count?: number;
    address_count?: number;
    is_archived?: boolean;
    has_appointment_history?: boolean;
    can_delete?: boolean;
}

export interface CustomerOverview {
    customer: Customer;
    pets: Array<{
        pet_id: string;
        pet_name: string;
        pet_type: string | null;
        pet_remark: string | null;
        is_archived?: boolean;
        has_appointment_history?: boolean;
        can_delete?: boolean;
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

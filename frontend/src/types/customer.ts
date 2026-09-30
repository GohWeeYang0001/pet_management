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
    appointment_history: Array<{
        appointment_id: string;
        appointment_date: string;
        start_time: string;
        status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
        amount: number;
        pets: Array<{ pet_name: string; service_name: string; amount: number | null }>;
    }>;
}

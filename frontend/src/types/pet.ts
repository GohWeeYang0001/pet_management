export interface Pet {
    pet_id: string;
    customer_id: string;
    pet_name: string;
    pet_type: string | null;
    pet_remark: string | null;
    is_archived?: boolean;
    has_appointment_history?: boolean;
    can_delete?: boolean;
}

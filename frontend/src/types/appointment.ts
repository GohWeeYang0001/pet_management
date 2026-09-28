export interface AppointmentPet {
    appointment_pet_id: number;
    pet_id: number;
    pet_name: string;
    pet_type: string | null;

    service_id: number;
    service_name: string;
    default_price: number | null;

    amount: number | null;
    remark: string | null;
}

export interface Appointment {
    appointment_id: string;
    appointment_date: string;
    start_time: string;
    status: string;
    remark: string | null;

    customer_id: string;
    customer_name: string;
    customer_hp: string;

    pets: AppointmentPet[];
}
import { useEffect, useState } from "react";

import { getAppointments } from "../services/appointmentService";
import type { Appointment } from "../types/appointment";

function AppointmentsPage() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        async function loadAppointments() {
            try {
                const data = await getAppointments();

                setAppointments(data);
            } catch (error) {
                console.error(error);

                setError("Failed to load appointments");
            } finally {
                setLoading(false);
            }
        }

        loadAppointments();
    }, []);

    if (loading) {
        return <p>Loading appointments...</p>;
    }

    if (error) {
        return <p>{error}</p>;
    }

    return (
        <div>
            <h1>Appointments</h1>

            {appointments.map((appointment) => (
                <div key={appointment.appointment_id}>
                    <h2>{appointment.customer_name}</h2>

                    <p>
                        Date: {appointment.appointment_date}
                    </p>

                    <p>
                        Time: {appointment.start_time}
                    </p>

                    <p>
                        Phone: {appointment.customer_hp}
                    </p>

                    <p>
                        Status: {appointment.status}
                    </p>

                    {appointment.remark && (
                        <p>
                            Appointment Remark: {appointment.remark}
                        </p>
                    )}

                    <h3>Pets</h3>

                    {appointment.pets.map((pet) => (
                        <div key={pet.appointment_pet_id}>
                            <p>
                                Pet: {pet.pet_name}
                                {pet.pet_type && ` (${pet.pet_type})`}
                            </p>

                            <p>
                                Service: {pet.service_name}
                            </p>

                            <p>
                                Default Price: RM
                                {pet.default_price ?? "-"}
                            </p>

                            {pet.remark && (
                                <p>
                                    Remark: {pet.remark}
                                </p>
                            )}

                            <hr />
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}

export default AppointmentsPage;
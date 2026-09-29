import BottomSheet from "./BottomSheet";
import type { Appointment } from "../../types/appointment";

interface DayAppointmentsSheetProps {
    date: string;
    appointments: Appointment[];
    onClose: () => void;
}

const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatDate(date: string) {
    const [year, month, day] = date.split("-");

    return `${Number(day)} ${monthNames[Number(month) - 1]} ${year}`;
}

function formatTime(time: string) {
    const [rawHour, minute] = time.split(":");
    const hour = Number(rawHour);
    const suffix = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;

    return `${displayHour}:${minute} ${suffix}`;
}

function statusClass(status: Appointment["status"]) {
    return `status-${status.toLowerCase()}`;
}

function DayAppointmentsSheet({ date, appointments, onClose }: DayAppointmentsSheetProps) {
    const sortedAppointments = [...appointments].sort((a, b) =>
        a.start_time.localeCompare(b.start_time),
    );
    const appointmentLabel = `${appointments.length} Appointment${appointments.length === 1 ? "" : "s"}`;

    return (
        <BottomSheet title={formatDate(date)} subtitle={appointmentLabel} onClose={onClose}>
            {sortedAppointments.length > 0 ? (
                <div className="appointment-list">
                    {sortedAppointments.map((appointment) => {
                        const className = statusClass(appointment.status);

                        return (
                            <article
                                className={`appointment-card ${className}`}
                                key={appointment.appointment_id}
                            >
                                <p className="appointment-time">{formatTime(appointment.start_time)}</p>
                                <p className="appointment-customer">{appointment.customer_name}</p>
                                {appointment.pets.map((pet) => (
                                    <p className="pet-service" key={pet.appointment_pet_id}>
                                        {pet.pet_name} — {pet.service_name}
                                    </p>
                                ))}
                                <span className={`status-badge ${className}`}>
                                    {appointment.status}
                                </span>
                                <span className="appointment-chevron" aria-hidden="true">›</span>
                            </article>
                        );
                    })}
                </div>
            ) : (
                <div className="empty-appointments">No appointments</div>
            )}

            <button
                className="add-appointment-button"
                type="button"
                disabled
                aria-label="Add Appointment (coming soon)"
            >
                + Add Appointment
            </button>
        </BottomSheet>
    );
}

export default DayAppointmentsSheet;

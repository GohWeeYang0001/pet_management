import BottomSheet from "./BottomSheet";
import type { Appointment } from "../../types/appointment";
import { formatAppointmentDate, formatAppointmentTime } from "../../utils/appointmentFormat";

interface DayAppointmentsSheetProps {
    date: string;
    appointments: Appointment[];
    onClose: () => void;
    onAppointmentSelect: (id: string) => void;
    onAddAppointment: () => void;
}

function statusClass(status: Appointment["status"]) {
    return `status-${status.toLowerCase()}`;
}

function DayAppointmentsSheet({ date, appointments, onClose, onAppointmentSelect, onAddAppointment }: DayAppointmentsSheetProps) {
    const sortedAppointments = [...appointments].sort((a, b) =>
        a.start_time.localeCompare(b.start_time),
    );
    const appointmentLabel = `${appointments.length} Appointment${appointments.length === 1 ? "" : "s"}`;

    return (
        <BottomSheet title={formatAppointmentDate(date)} subtitle={appointmentLabel} onClose={onClose}>
            {sortedAppointments.length > 0 ? (
                <div className="appointment-list">
                    {sortedAppointments.map((appointment) => {
                        const className = statusClass(appointment.status);

                        return (
                            <button
                                type="button"
                                className={`appointment-card ${className}`}
                                key={appointment.appointment_id}
                                onClick={() => onAppointmentSelect(appointment.appointment_id)}
                                aria-label={`View ${appointment.customer_name}'s appointment at ${formatAppointmentTime(appointment.start_time)}`}
                            >
                                <p className="appointment-time">{formatAppointmentTime(appointment.start_time)}</p>
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
                            </button>
                        );
                    })}
                </div>
            ) : (
                <div className="empty-appointments">No appointments</div>
            )}

            <button
                className="add-appointment-button"
                type="button"
                onClick={onAddAppointment}
            >
                + Add Appointment
            </button>
        </BottomSheet>
    );
}

export default DayAppointmentsSheet;

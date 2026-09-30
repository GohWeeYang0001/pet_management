import BottomSheet from "../sheets/BottomSheet";
import type { Appointment } from "../../types/appointment";
import { formatAppointmentDate, formatAppointmentTime, formatMoney } from "../../utils/appointmentFormat";

interface Props {
    appointment: Appointment;
    onClose: () => void;
    onComplete: () => void;
}

function AppointmentDetailSheet({ appointment, onClose, onComplete }: Props) {
    return (
        <BottomSheet title="Appointment details" subtitle={appointment.customer_name} onClose={onClose}>
            <div className="detail-summary">
                <h3>{appointment.customer_name}</h3>
                <a href={`tel:${appointment.customer_hp}`}>{appointment.customer_hp}</a>
                <p>{formatAppointmentDate(appointment.appointment_date)} · {formatAppointmentTime(appointment.start_time)}</p>
                <span className={`status-badge status-${appointment.status.toLowerCase()}`}>{appointment.status}</span>
                {appointment.remark && <p><strong>Appointment remark:</strong> {appointment.remark}</p>}
            </div>
            <div className="detail-pets">
                {appointment.pets.map((pet) => (
                    <section className="detail-pet" key={pet.appointment_pet_id}>
                        <h3>{pet.pet_name}</h3>
                        {pet.pet_type && <p>{pet.pet_type}</p>}
                        <p>{pet.service_name}</p>
                        <p>Default: {formatMoney(pet.default_price)}</p>
                        <p>Actual: {pet.amount === null ? "Not completed" : formatMoney(pet.amount)}</p>
                        {pet.remark && <p><strong>Remark:</strong> {pet.remark}</p>}
                    </section>
                ))}
            </div>
            {appointment.status !== "COMPLETED" && appointment.status !== "CANCELLED" && (
                <button className="primary-button" type="button" onClick={onComplete}>Complete Appointment</button>
            )}
            <button className="secondary-button" type="button" onClick={onClose}>Close</button>
        </BottomSheet>
    );
}

export default AppointmentDetailSheet;

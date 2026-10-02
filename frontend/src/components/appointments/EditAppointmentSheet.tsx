import { useEffect, useState } from "react";
import BottomSheet from "../sheets/BottomSheet";
import { editAppointment } from "../../services/appointmentService";
import { getCustomerPets } from "../../services/petService";
import { getServices } from "../../services/serviceService";
import type { Appointment } from "../../types/appointment";
import type { Pet } from "../../types/pet";
import type { Service } from "../../types/service";
import { formatMoney } from "../../utils/appointmentFormat";

interface Props { appointment: Appointment; onClose: () => void; onSuccess: (date: string) => Promise<void> }
interface Row { key: number; appointment_pet_id?: number; pet_id: string; service_id: string; remark: string }

export default function EditAppointmentSheet({ appointment, onClose, onSuccess }: Props) {
    const [date, setDate] = useState(appointment.appointment_date);
    const [time, setTime] = useState(appointment.start_time.slice(0, 5));
    const [remark, setRemark] = useState(appointment.remark ?? "");
    const [rows, setRows] = useState<Row[]>(appointment.pets.map((pet, index) => ({
        key: index + 1, appointment_pet_id: pet.appointment_pet_id, pet_id: String(pet.pet_id),
        service_id: String(pet.service_id), remark: pet.remark ?? "",
    })));
    const [pets, setPets] = useState<Pet[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let current = true;
        Promise.all([getCustomerPets(appointment.customer_id), getServices(true)])
            .then(([petData, serviceData]) => { if (current) { setPets(petData); setServices(serviceData); } })
            .catch(() => { if (current) setError("Could not load pets or services. Please reopen this form."); })
            .finally(() => { if (current) setLoading(false); });
        return () => { current = false; };
    }, [appointment.customer_id]);

    function changeRow(key: number, field: "pet_id" | "service_id" | "remark", value: string) {
        setRows((current) => current.map((row) => row.key === key ? { ...row, [field]: value } : row));
    }

    async function save() {
        if (!date || !time || rows.length === 0 || rows.some((row) => !row.pet_id || !row.service_id)) {
            setError("Date, time, pet and service are required for each row."); return;
        }
        setSubmitting(true); setError("");
        try {
            await editAppointment(appointment.appointment_id, {
                appointment_date: date, start_time: time, remark: remark.trim() || null,
                pets: rows.map((row) => ({ appointment_pet_id: row.appointment_pet_id, pet_id: row.pet_id,
                    service_id: row.service_id, remark: row.remark.trim() || null })),
            });
            await onSuccess(date);
        } catch (failure) {
            console.error(failure);
            setError("Could not save the appointment. Check the details and try again.");
        } finally { setSubmitting(false); }
    }

    return <BottomSheet title="Edit Appointment" subtitle={appointment.customer_name} onClose={onClose}>
        {loading ? <p className="form-hint">Loading form...</p> : <div className="sheet-form">
            <div className="form-card appointment-time-fields">
                <label>Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
                <label>Time<input type="time" value={time} onChange={(event) => setTime(event.target.value)} required /></label>
                <p className="form-hint">Customer: {appointment.customer_name}</p>
            </div>
            {rows.map((row, index) => <div className="form-card" key={row.key}>
                <div className="form-card-heading"><h3>Pet {index + 1}</h3>
                    {rows.length > 1 && <button type="button" className="text-button" onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}>Remove</button>}
                </div>
                <label>Pet<select value={row.pet_id} onChange={(event) => changeRow(row.key, "pet_id", event.target.value)} required>
                    <option value="">Choose pet</option>{pets.map((pet) => <option key={pet.pet_id} value={pet.pet_id}>{pet.pet_name}</option>)}
                </select></label>
                <label>Service<select value={row.service_id} onChange={(event) => changeRow(row.key, "service_id", event.target.value)} required>
                    <option value="">Choose service</option>{services.filter((service) => service.is_active || String(service.service_id) === row.service_id)
                        .map((service) => <option key={service.service_id} value={service.service_id}>{service.service_name} · {formatMoney(service.default_price)}{service.is_active ? "" : " (inactive)"}</option>)}
                </select></label>
                <label>Pet remark<textarea rows={2} value={row.remark} onChange={(event) => changeRow(row.key, "remark", event.target.value)} /></label>
            </div>)}
            <button className="text-button" type="button" onClick={() => setRows((current) => [...current, { key: Math.max(0, ...current.map((row) => row.key)) + 1, pet_id: "", service_id: "", remark: "" }])}>+ Add Another Pet</button>
            <div className="form-card"><label>Appointment remark<textarea rows={2} value={remark} onChange={(event) => setRemark(event.target.value)} /></label></div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary-button" type="button" onClick={save} disabled={submitting || Boolean(error && !pets.length)}>{submitting ? "Saving..." : "Save Changes"}</button>
            <button className="secondary-button" type="button" onClick={onClose} disabled={submitting}>Back</button>
        </div>}
    </BottomSheet>;
}

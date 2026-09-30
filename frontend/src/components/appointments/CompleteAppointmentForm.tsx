import { useState, type FormEvent } from "react";
import BottomSheet from "../sheets/BottomSheet";
import { completeAppointment } from "../../services/appointmentService";
import type { Appointment } from "../../types/appointment";
import { formatMoney } from "../../utils/appointmentFormat";

interface Props {
    appointment: Appointment;
    onClose: () => void;
    onSuccess: () => Promise<void>;
}

function CompleteAppointmentForm({ appointment, onClose, onSuccess }: Props) {
    const [entries, setEntries] = useState(() => appointment.pets.map((pet) => ({
        appointment_pet_id: pet.appointment_pet_id,
        amount: pet.amount !== null ? String(pet.amount) : pet.default_price !== null ? Number(pet.default_price).toFixed(2) : "",
        remark: pet.remark ?? "",
    })));
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    function updateEntry(index: number, field: "amount" | "remark", value: string) {
        setEntries((current) => current.map((entry, entryIndex) =>
            entryIndex === index ? { ...entry, [field]: value } : entry,
        ));
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (submitting) return;
        const invalid = entries.some((entry) => !entry.amount.trim() ||
            !/^\d+(\.\d{1,2})?$/.test(entry.amount.trim()));
        if (invalid) {
            setError("Enter a non-negative amount with up to two decimal places for every pet.");
            return;
        }
        setSubmitting(true);
        setError("");
        try {
            await completeAppointment(appointment.appointment_id, {
                pets: entries.map((entry) => ({
                    appointment_pet_id: entry.appointment_pet_id,
                    amount: Number(entry.amount),
                    remark: entry.remark.trim() || null,
                })),
            });
            await onSuccess();
        } catch (submitError) {
            console.error(submitError);
            setError("Could not complete this appointment. Please try again.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <BottomSheet title="Complete Appointment" subtitle={appointment.customer_name} onClose={onClose}>
            <form className="sheet-form" onSubmit={submit}>
                {entries.map((entry, index) => {
                    const pet = appointment.pets[index];
                    return (
                        <fieldset className="form-card" key={entry.appointment_pet_id} disabled={submitting}>
                            <legend>{pet.pet_name} · {pet.service_name}</legend>
                            <p className="form-hint">Default price: {formatMoney(pet.default_price)}</p>
                            <label>Actual Amount (RM)
                                <input type="number" min="0" step="0.01" inputMode="decimal" required value={entry.amount}
                                    onChange={(event) => updateEntry(index, "amount", event.target.value)} />
                            </label>
                            <label>Remark
                                <textarea rows={2} value={entry.remark} onChange={(event) => updateEntry(index, "remark", event.target.value)} />
                            </label>
                        </fieldset>
                    );
                })}
                {error && <p className="form-error" role="alert">{error}</p>}
                <button className="primary-button" type="submit" disabled={submitting}>
                    {submitting ? "Completing..." : "Save and Complete"}
                </button>
                <button className="secondary-button" type="button" onClick={onClose} disabled={submitting}>Back to details</button>
            </form>
        </BottomSheet>
    );
}

export default CompleteAppointmentForm;

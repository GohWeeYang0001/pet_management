import { useCallback, useEffect, useMemo, useState } from "react";

import AppointmentCalendar from "../components/calendar/AppointmentCalendar";
import AppointmentDetailSheet from "../components/appointments/AppointmentDetailSheet";
import CompleteAppointmentForm from "../components/appointments/CompleteAppointmentForm";
import EditAppointmentSheet from "../components/appointments/EditAppointmentSheet";
import DayAppointmentsSheet from "../components/sheets/DayAppointmentsSheet";
import NewAppointmentSheet from "../components/sheets/NewAppointmentSheet";
import { cancelAppointment, getAppointments } from "../services/appointmentService";
import type { Appointment } from "../types/appointment";

function CalendarPage() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
    const [activeSheet, setActiveSheet] = useState<"day" | "detail" | "complete" | "edit" | "new">("day");
    const [cancelling, setCancelling] = useState(false);
    const [actionError, setActionError] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [refreshError, setRefreshError] = useState("");

    const refreshAppointments = useCallback(async (): Promise<boolean> => {
        try {
            const data = await getAppointments();
            setAppointments(data);
            setRefreshError("");
            return true;
        } catch (refreshFailure) {
            console.error(refreshFailure);
            setRefreshError("Saved, but appointments could not be refreshed. Try again to see the latest data.");
            return false;
        }
    }, []);

    useEffect(() => {
        let current = true;
        getAppointments()
            .then((data) => { if (current) setAppointments(data); })
            .catch((loadError) => {
                console.error(loadError);
                if (current) setError("Unable to load appointments.");
            })
            .finally(() => { if (current) setLoading(false); });
        return () => { current = false; };
    }, []);

    const selectedAppointments = useMemo(
        () =>
            selectedDate
                ? appointments.filter(
                    (appointment) => appointment.appointment_date === selectedDate,
                )
                : [],
        [appointments, selectedDate],
    );

    const closeSheet = useCallback(() => setSelectedDate(null), []);
    const selectedAppointment = appointments.find((appointment) => appointment.appointment_id === selectedAppointmentId);

    function selectDate(date: string) {
        setSelectedDate(date);
        setSelectedAppointmentId(null);
        setActiveSheet("day");
    }

    async function completeAndRefresh() {
        const refreshed = await refreshAppointments();
        setActiveSheet(refreshed ? "detail" : "day");
    }

    async function createAndRefresh() {
        await refreshAppointments();
        setActiveSheet("day");
    }

    async function editAndRefresh(date: string) {
        await refreshAppointments();
        setSelectedDate(date);
        setActiveSheet("detail");
    }

    async function confirmCancel() {
        if (!selectedAppointment || !window.confirm("Cancel this appointment? It will remain in history.")) return;
        setCancelling(true);
        setActionError("");
        try {
            await cancelAppointment(selectedAppointment.appointment_id);
            await refreshAppointments();
            setActiveSheet("day");
        } catch (failure) {
            console.error(failure);
            setActionError("Could not cancel the appointment. Please try again.");
        } finally {
            setCancelling(false);
        }
    }

    return (
        <>
            <header className="page-header">
                <p className="page-eyebrow">Pet Management</p>
                <h1 className="page-title">Calendar</h1>
            </header>

            {refreshError && (
                <div className="refresh-notice" role="alert">
                    <span>{refreshError}</span>
                    <button type="button" onClick={refreshAppointments}>Retry</button>
                </div>
            )}

            <section className="calendar-card" aria-label="Appointment calendar">
                {loading && <div className="calendar-state">Loading appointments...</div>}
                {!loading && error && <div className="calendar-state error">{error}</div>}
                {!loading && !error && (
                    <AppointmentCalendar
                        appointments={appointments}
                        onDateSelect={selectDate}
                    />
                )}
            </section>

            {selectedDate && activeSheet === "day" && (
                <DayAppointmentsSheet
                    date={selectedDate}
                    appointments={selectedAppointments}
                    onClose={closeSheet}
                    onAppointmentSelect={(id) => {
                        setSelectedAppointmentId(id);
                        setActiveSheet("detail");
                    }}
                    onAddAppointment={() => setActiveSheet("new")}
                />
            )}
            {selectedDate && activeSheet === "new" && (
                <NewAppointmentSheet date={selectedDate} onClose={() => setActiveSheet("day")} onSuccess={createAndRefresh} />
            )}
            {selectedAppointment && activeSheet === "detail" && (
                <AppointmentDetailSheet appointment={selectedAppointment} onClose={() => setActiveSheet("day")}
                    onComplete={() => setActiveSheet("complete")} onEdit={() => setActiveSheet("edit")}
                    onCancel={confirmCancel} busy={cancelling} />
            )}
            {selectedAppointment && activeSheet === "detail" && actionError && <p className="floating-error" role="alert">{actionError}</p>}
            {selectedAppointment && activeSheet === "edit" && (
                <EditAppointmentSheet appointment={selectedAppointment} onClose={() => setActiveSheet("detail")}
                    onSuccess={editAndRefresh} />
            )}
            {selectedAppointment && activeSheet === "complete" && (
                <CompleteAppointmentForm appointment={selectedAppointment} onClose={() => setActiveSheet("detail")}
                    onSuccess={completeAndRefresh} />
            )}
        </>
    );
}

export default CalendarPage;

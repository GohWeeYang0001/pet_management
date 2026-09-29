import { useCallback, useEffect, useMemo, useState } from "react";

import AppointmentCalendar from "../components/calendar/AppointmentCalendar";
import DayAppointmentsSheet from "../components/sheets/DayAppointmentsSheet";
import { getAppointments } from "../services/appointmentService";
import type { Appointment } from "../types/appointment";

function CalendarPage() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let isCurrent = true;

        async function loadAppointments() {
            try {
                const data = await getAppointments();

                if (isCurrent) {
                    setAppointments(data);
                }
            } catch (loadError) {
                console.error(loadError);

                if (isCurrent) {
                    setError("Unable to load appointments.");
                }
            } finally {
                if (isCurrent) {
                    setLoading(false);
                }
            }
        }

        loadAppointments();

        return () => {
            isCurrent = false;
        };
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

    return (
        <>
            <header className="page-header">
                <p className="page-eyebrow">Pet Management</p>
                <h1 className="page-title">Calendar</h1>
            </header>

            <section className="calendar-card" aria-label="Appointment calendar">
                {loading && <div className="calendar-state">Loading appointments...</div>}
                {!loading && error && <div className="calendar-state error">{error}</div>}
                {!loading && !error && (
                    <AppointmentCalendar
                        appointments={appointments}
                        onDateSelect={setSelectedDate}
                    />
                )}
            </section>

            {selectedDate && (
                <DayAppointmentsSheet
                    date={selectedDate}
                    appointments={selectedAppointments}
                    onClose={closeSheet}
                />
            )}
        </>
    );
}

export default CalendarPage;

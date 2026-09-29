import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DayCellContentArg, EventInput } from "@fullcalendar/core";
import { useMemo } from "react";

import type { Appointment } from "../../types/appointment";

interface AppointmentCalendarProps {
    appointments: Appointment[];
    onDateSelect: (date: string) => void;
}

function toLocalDateKey(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function AppointmentCalendar({ appointments, onDateSelect }: AppointmentCalendarProps) {
    const appointmentCounts = useMemo(() => {
        const counts = new Map<string, number>();

        appointments.forEach((appointment) => {
            counts.set(
                appointment.appointment_date,
                (counts.get(appointment.appointment_date) ?? 0) + 1,
            );
        });

        return counts;
    }, [appointments]);

    const events = useMemo<EventInput[]>(
        () =>
            appointments.map((appointment) => ({
                id: appointment.appointment_id,
                start: `${appointment.appointment_date}T${appointment.start_time}`,
                title: appointment.customer_name,
                display: "none",
                extendedProps: { appointment },
            })),
        [appointments],
    );

    function renderDayCell(arg: DayCellContentArg) {
        const count = appointmentCounts.get(toLocalDateKey(arg.date)) ?? 0;

        return (
            <>
                <span className="fc-daygrid-day-number">{arg.dayNumberText}</span>
                {count > 0 && (
                    <span
                        className="day-appointment-count"
                        aria-label={`${count} appointment${count === 1 ? "" : "s"}`}
                    >
                        {count}
                    </span>
                )}
            </>
        );
    }

    return (
        <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{ left: "prev,next", center: "title", right: "today" }}
            events={events}
            dayCellContent={renderDayCell}
            dateClick={(info) => onDateSelect(info.dateStr)}
            fixedWeekCount={false}
            showNonCurrentDates
            height="auto"
            eventDisplay="none"
            dayMaxEvents={false}
            buttonText={{ today: "Today" }}
        />
    );
}

export default AppointmentCalendar;

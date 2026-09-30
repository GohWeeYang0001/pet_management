import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DayCellContentArg, EventInput } from "@fullcalendar/core";
import { useMemo } from "react";

import type { Appointment, AppointmentStatus } from "../../types/appointment";

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

const statusOrder: AppointmentStatus[] = ["CONFIRMED", "COMPLETED", "CANCELLED"];

function AppointmentCalendar({ appointments, onDateSelect }: AppointmentCalendarProps) {
    const appointmentCounts = useMemo(() => {
        const counts = new Map<string, Record<AppointmentStatus, number>>();

        appointments.forEach((appointment) => {
            const day = counts.get(appointment.appointment_date) ?? {
                CONFIRMED: 0, COMPLETED: 0, CANCELLED: 0,
            };
            day[appointment.status] += 1;
            counts.set(appointment.appointment_date, day);
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
        const counts = appointmentCounts.get(toLocalDateKey(arg.date));

        return (
            <>
                <span className="fc-daygrid-day-number">{arg.dayNumberText}</span>
                {counts && <span className="day-status-indicators">
                    {statusOrder.filter((status) => counts[status] > 0).map((status) => <span
                        className={`day-status-count status-${status.toLowerCase()}`}
                        aria-label={`${counts[status]} ${status.toLowerCase()} appointment${counts[status] === 1 ? "" : "s"}`}
                        key={status}
                    ><span className="status-dot" aria-hidden="true" />{counts[status]}</span>)}
                </span>}
            </>
        );
    }

    return (
        <><FullCalendar
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
        <div className="calendar-status-legend" aria-label="Appointment status legend">
            {statusOrder.map((status) => <span key={status} className={`legend-item status-${status.toLowerCase()}`}>
                <span className="status-dot" aria-hidden="true" />{status.charAt(0) + status.slice(1).toLowerCase()}
            </span>)}
        </div></>
    );
}

export default AppointmentCalendar;

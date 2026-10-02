import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import zhCnLocale from "@fullcalendar/core/locales/zh-cn";
import type { DayCellContentArg, EventInput } from "@fullcalendar/core";
import { useEffect, useMemo, useRef, type MouseEvent, type KeyboardEvent } from "react";

import type { Appointment, AppointmentStatus } from "../../types/appointment";
import { appointmentStatusLabels } from "../../utils/displayLabels";

interface AppointmentCalendarProps {
    appointments: Appointment[];
    selectedDate: string | null;
    onDateSelect: (date: string) => void;
}

function toLocalDateKey(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

const statusOrder: AppointmentStatus[] = ["CONFIRMED", "COMPLETED", "CANCELLED"];

function AppointmentCalendar({ appointments, selectedDate, onDateSelect }: AppointmentCalendarProps) {
    const calendarRoot = useRef<HTMLDivElement>(null);

    // FullCalendar owns the focusable frames. Keep their accessible pressed state
    // in sync with the same date that owns the sheet, without a second selection.
    useEffect(() => {
        calendarRoot.current?.querySelectorAll<HTMLElement>(".fc-daygrid-day[data-date]").forEach((cell) => {
            cell.querySelector(".fc-daygrid-day-frame")?.setAttribute("aria-pressed", String(cell.dataset.date === selectedDate));
        });
    }, [selectedDate]);

    function selectDay(event: MouseEvent<HTMLDivElement> | KeyboardEvent<HTMLDivElement>) {
        if (!(event.target instanceof Element)) return;
        const cell = event.target.closest<HTMLElement>(".fc-daygrid-day[data-date]");
        if (!cell || !event.currentTarget.contains(cell) || cell.classList.contains("fc-day-disabled")) return;
        if ("key" in event) {
            if (event.key !== "Enter" && event.key !== " ") return;
            if (!event.target.classList.contains("fc-daygrid-day-frame")) return;
            event.preventDefault();
        }
        const date = cell.dataset.date;
        if (date) onDateSelect(date);
    }
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
                <span className="calendar-day-number">{arg.dayNumberText}</span>
                {counts && <span className="day-status-indicators">
                    {statusOrder.filter((status) => counts[status] > 0).map((status) => <span
                        className={`day-status-count status-${status.toLowerCase()}`}
                        aria-label={`${counts[status]}个${appointmentStatusLabels[status]}预约`}
                        key={status}
                    ><span className="status-dot" aria-hidden="true" />{counts[status]}</span>)}
                </span>}
            </>
        );
    }

    return (
        <><div ref={calendarRoot} onClick={selectDay} onKeyDown={selectDay}><FullCalendar
            plugins={[dayGridPlugin]}
            locale={zhCnLocale}
            firstDay={0}
            initialView="dayGridMonth"
            headerToolbar={{ left: "prev,next", center: "title", right: "today" }}
            events={events}
            dayCellContent={renderDayCell}
            dayCellClassNames={(arg) => toLocalDateKey(arg.date) === selectedDate ? ["calendar-day-selected"] : []}
            // A single native click path opens after Safari's synthesized click,
            // rather than opening on touchend before its subsequent mouse events.
            dayCellDidMount={(arg) => {
                const frame = arg.el.querySelector<HTMLElement>(".fc-daygrid-day-frame");
                if (!frame || arg.el.classList.contains("fc-day-disabled")) return;
                frame.tabIndex = 0;
                frame.setAttribute("role", "button");
                frame.setAttribute("aria-pressed", String(toLocalDateKey(arg.date) === selectedDate));
                frame.setAttribute("aria-label", `查看${arg.date.toLocaleDateString("zh-CN", {
                    weekday: "long", year: "numeric", month: "long", day: "numeric",
                })}的预约`);
            }}
            fixedWeekCount={false}
            showNonCurrentDates
            height="auto"
            eventDisplay="none"
            dayMaxEvents={false}
            buttonText={{ today: "今天" }}
            buttonHints={{ prev: "上个月", next: "下个月", today: "今天" }}
        /></div>
        <div className="calendar-status-legend" aria-label="预约状态说明">
            {statusOrder.map((status) => <span key={status} className={`legend-item status-${status.toLowerCase()}`}>
                <span className="status-dot" aria-hidden="true" />{appointmentStatusLabels[status]}
            </span>)}
        </div></>
    );
}

export default AppointmentCalendar;

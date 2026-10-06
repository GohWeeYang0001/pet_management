import { useState, useSyncExternalStore } from "react";
import type { CustomerHistoryStore } from "../../utils/customerHistoryStore";
import AppointmentV2Details from "../appointments/AppointmentV2Details";
import { appointmentStatusLabels } from "../../utils/displayLabels";
import { formatAppointmentDate, formatAppointmentTime } from "../../utils/appointmentFormat";

export default function CustomerAppointmentHistory({customerId,store}: {customerId:string;store:CustomerHistoryStore}) {
    const [visible,setVisible] = useState(false);
    const state = useSyncExternalStore(listener => store.subscribe(customerId,listener),() => store.get(customerId),() => store.get(customerId));
    function toggle() {
        if (!visible) void store.loadFirst(customerId);
        setVisible(value => !value);
    }
    return <section className="v2-customer-history" aria-label="客户预约记录">
        <button className="secondary-button" type="button" aria-expanded={visible} onClick={toggle}>{visible ? "收起预约记录" : "查看预约记录"}</button>
        {visible && <div className="v2-history-pages">
            {state.loading && <p className="form-hint" role="status">加载预约记录...</p>}
            {state.error && <div><p className="form-error" role="alert">预约记录加载失败，请重试。</p>
                <button className="text-button" type="button" disabled={state.loading} onClick={() => void (state.loaded ? store.loadMore(customerId) : store.loadFirst(customerId))}>重试预约记录</button></div>}
            {state.loaded && !state.appointments.length && <p className="form-hint">暂无预约记录</p>}
            {state.appointments.map(entry => <div className="form-card" key={entry.appointment_id}>
                <div className="split-line"><strong>{formatAppointmentDate(entry.appointment_date)} · {formatAppointmentTime(entry.start_time)}</strong>
                    <span className={`status-badge status-${entry.status.toLowerCase()}`}>{appointmentStatusLabels[entry.status]}</span></div>
                <AppointmentV2Details appointment={entry} compact />
            </div>)}
            {state.loaded && state.nextOffset !== null && !state.error && <button className="secondary-button" type="button" disabled={state.loading} onClick={() => void store.loadMore(customerId)}>加载更多</button>}
        </div>}
    </section>;
}

import { useEffect, useState } from "react";
import MonthPicker from "../components/MonthPicker";
import { getMonthlyReport } from "../services/reportService";
import type { MonthlyReport } from "../types/report";
import { formatAppointmentDate, formatMoney } from "../utils/appointmentFormat";
import { currentMonth } from "../utils/month";

export default function RevenuePage() {
    const [month, setMonth] = useState(currentMonth());
    const [report, setReport] = useState<MonthlyReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    useEffect(() => {
        let current = true;
        getMonthlyReport(month).then((data) => { if (current) { setReport(data); setError(""); } })
            .catch(() => { if (current) setError("本月报表加载失败。"); })
            .finally(() => { if (current) setLoading(false); });
        return () => { current = false; };
    }, [month]);
    const max = Math.max(1, ...(report?.daily.map((day) => day.revenue) ?? []));
    return <main className="business-page"><MonthPicker month={month} onChange={(next) => { setMonth(next); setLoading(true); }} />
        {error && <p className="form-error" role="alert">{error}</p>}
        {loading ? <p className="form-hint">报表加载中...</p> : report && <>
            <div className="summary-grid">
                <div className="summary-card"><small>营业额</small><strong>{formatMoney(report.revenue)}</strong></div>
                <div className="summary-card"><small>已完成预约</small><strong>{report.completed_appointments}</strong></div>
                <div className="summary-card"><small>支出</small><strong>{formatMoney(report.expenses)}</strong></div>
                <div className="summary-card"><small>净额</small><strong>{formatMoney(report.net)}</strong></div>
            </div>
            <p className="form-hint">净额为营业额减去已记录支出，并非会计利润。</p>
            <h2 className="section-heading">每日营业额</h2>
            <div className="business-list">{report.daily.length ? report.daily.map((day) => <div className="daily-row" key={day.date}>
                <div className="split-line"><strong>{formatAppointmentDate(day.date)}</strong><strong>{formatMoney(day.revenue)}</strong></div>
                <small>{day.completed_appointments} 次已完成服务</small>
                <div className="bar-track"><div style={{ width: `${Math.max(2, day.revenue / max * 100)}%` }} /></div>
            </div>) : <p className="empty-state">本月暂无已完成预约。</p>}</div>
        </>}
    </main>;
}

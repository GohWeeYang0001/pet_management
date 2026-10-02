import { monthTitle, shiftMonth } from "../utils/month";

export default function MonthPicker({ month, onChange }: { month: string; onChange: (month: string) => void }) {
    return <div className="month-picker">
        <button type="button" aria-label="上个月" onClick={() => onChange(shiftMonth(month, -1))}>‹</button>
        <strong>{monthTitle(month)}</strong>
        <button type="button" aria-label="下个月" onClick={() => onChange(shiftMonth(month, 1))}>›</button>
    </div>;
}

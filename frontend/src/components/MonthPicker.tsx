import { monthTitle, shiftMonth } from "../utils/month";

export default function MonthPicker({ month, onChange }: { month: string; onChange: (month: string) => void }) {
    return <div className="month-picker">
        <button type="button" aria-label="Previous month" onClick={() => onChange(shiftMonth(month, -1))}>‹</button>
        <strong>{monthTitle(month)}</strong>
        <button type="button" aria-label="Next month" onClick={() => onChange(shiftMonth(month, 1))}>›</button>
    </div>;
}

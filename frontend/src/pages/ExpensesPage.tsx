import { useEffect, useState } from "react";
import MonthPicker from "../components/MonthPicker";
import BottomSheet from "../components/sheets/BottomSheet";
import { createExpense, deleteExpense, getExpenses, updateExpense } from "../services/expenseService";
import type { Expense } from "../types/expense";
import { formatAppointmentDate, formatMoney } from "../utils/appointmentFormat";
import { currentMonth, todayDateOnly } from "../utils/month";

export default function ExpensesPage() {
    const [month, setMonth] = useState(currentMonth());
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [selected, setSelected] = useState<Expense | null | undefined>(undefined);
    const [date, setDate] = useState(todayDateOnly());
    const [category, setCategory] = useState("OTHER");
    const [item, setItem] = useState("");
    const [amount, setAmount] = useState("");
    const [remark, setRemark] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [formError, setFormError] = useState("");

    useEffect(() => {
        let current = true;
        getExpenses(month).then((data) => { if (current) { setExpenses(data); setError(""); } })
            .catch(() => { if (current) setError("Could not load expenses."); })
            .finally(() => { if (current) setLoading(false); });
        return () => { current = false; };
    }, [month]);
    async function refresh() { setExpenses(await getExpenses(month)); }
    function open(expense: Expense | null) {
        setSelected(expense); setFormError("");
        setDate(expense?.expense_date ?? todayDateOnly()); setCategory(expense?.category ?? "OTHER");
        setItem(expense?.item_name ?? ""); setAmount(expense ? String(expense.amount) : ""); setRemark(expense?.remark ?? "");
    }
    async function save() {
        const value = Number(amount);
        if (!date || !category.trim() || !item.trim() || amount === "" || !Number.isFinite(value) || value < 0) {
            setFormError("Date, category, item and a valid non-negative amount are required."); return;
        }
        setSaving(true); setFormError("");
        try {
            const input = { expense_date: date, category: category.trim().toUpperCase(), item_name: item.trim(), amount: value, remark: remark.trim() || null };
            if (selected) await updateExpense(selected.expense_id, input); else await createExpense(input);
            const savedMonth = date.slice(0, 7);
            setMonth(savedMonth);
            setExpenses(await getExpenses(savedMonth)); setSelected(undefined);
        } catch (failure) { console.error(failure); setFormError("Could not save expense. Please try again."); }
        finally { setSaving(false); }
    }
    async function remove() {
        if (!selected || !window.confirm(`Delete expense “${selected.item_name}”?`)) return;
        setSaving(true); setFormError("");
        try { await deleteExpense(selected.expense_id); await refresh(); setSelected(undefined); }
        catch (failure) { console.error(failure); setFormError("Could not delete expense. Please try again."); }
        finally { setSaving(false); }
    }
    const total = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
    return <main className="business-page"><MonthPicker month={month} onChange={(next) => { setMonth(next); setLoading(true); }} />
        <div className="summary-card"><small>Selected month expenses</small><strong>{formatMoney(total)}</strong></div>
        <button className="primary-button" type="button" onClick={() => open(null)}>+ Add Expense</button>
        {error && <p className="form-error" role="alert">{error}</p>}
        {loading ? <p className="form-hint">Loading expenses...</p> : <div className="business-list">
            {expenses.length ? expenses.map((expense) => <button className="business-row" type="button" key={expense.expense_id} onClick={() => open(expense)}>
                <span><strong>{expense.item_name}</strong><small>{formatAppointmentDate(expense.expense_date)} · {expense.category}{expense.source === "INVENTORY" ? " · Stock purchase" : ""}</small></span><strong>{formatMoney(expense.amount)}</strong>
            </button>) : <p className="empty-state">No expenses this month.</p>}
        </div>}
        {selected !== undefined && <BottomSheet title={selected ? "Edit Expense" : "Add Expense"} onClose={() => setSelected(undefined)}>
            <div className="sheet-form"><div className="form-card">
                <label>Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
                <label>Category<input list="expense-categories" value={category} onChange={(event) => setCategory(event.target.value)} maxLength={50} required /></label>
                <datalist id="expense-categories"><option value="INVENTORY" /><option value="TOOLS" /><option value="TRANSPORT" /><option value="UTILITIES" /><option value="OTHER" /></datalist>
                <label>Item<input value={item} onChange={(event) => setItem(event.target.value)} maxLength={100} required /></label>
                <label>Amount (RM)<input type="number" min="0" step="0.01" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
                <label>Remark<textarea rows={2} value={remark} onChange={(event) => setRemark(event.target.value)} /></label>
                {selected?.source === "INVENTORY" && <p className="form-hint">This expense was generated from a stock purchase. Editing it does not change the inventory transaction.</p>}
            </div>{formError && <p className="form-error" role="alert">{formError}</p>}
                <button className="primary-button" type="button" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Expense"}</button>
                {selected && <button className="danger-button" type="button" onClick={remove} disabled={saving}>Delete Expense</button>}
            </div>
        </BottomSheet>}
    </main>;
}

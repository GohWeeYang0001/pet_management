import { useEffect, useState } from "react";
import MonthPicker from "../components/MonthPicker";
import BottomSheet from "../components/sheets/BottomSheet";
import { createExpense, deleteExpense, getExpenses, updateExpense } from "../services/expenseService";
import { expenseCategories, type Expense, type ExpenseCategory } from "../types/expense";
import { formatAppointmentDate, formatMoney } from "../utils/appointmentFormat";
import { currentMonth, todayDateOnly } from "../utils/month";

export default function ExpensesPage() {
    const [month, setMonth] = useState(currentMonth());
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [selected, setSelected] = useState<Expense | null | undefined>(undefined);
    const [date, setDate] = useState(todayDateOnly());
    const [category, setCategory] = useState<ExpenseCategory>("OTHER");
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
            .catch(() => { if (current) setError("支出加载失败。"); })
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
            setFormError("请填写日期、类别、物品及有效的非负金额。"); return;
        }
        setSaving(true); setFormError("");
        try {
            const input = { expense_date: date, category, item_name: item.trim(), amount: value, remark: remark.trim() || null };
            if (selected) await updateExpense(selected.expense_id, input); else await createExpense(input);
            const savedMonth = date.slice(0, 7);
            setMonth(savedMonth);
            setExpenses(await getExpenses(savedMonth)); setSelected(undefined);
        } catch (failure) { console.error(failure); setFormError("支出保存失败，请重试。"); }
        finally { setSaving(false); }
    }
    async function remove() {
        if (!selected || !window.confirm(`确定删除支出“${selected.item_name}”吗？`)) return;
        setSaving(true); setFormError("");
        try { await deleteExpense(selected.expense_id); await refresh(); setSelected(undefined); }
        catch (failure) { console.error(failure); setFormError("支出删除失败，请重试。"); }
        finally { setSaving(false); }
    }
    const total = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
    return <main className="business-page"><MonthPicker month={month} onChange={(next) => { setMonth(next); setLoading(true); }} />
        <div className="summary-card"><small>所选月份支出</small><strong>{formatMoney(total)}</strong></div>
        <button className="primary-button" type="button" onClick={() => open(null)}>+ 新增支出</button>
        {error && <p className="form-error" role="alert">{error}</p>}
        {loading ? <p className="form-hint">支出加载中...</p> : <div className="business-list">
            {expenses.length ? expenses.map((expense) => <button className="business-row" type="button" key={expense.expense_id} onClick={() => open(expense)}>
                <span><strong>{expense.item_name}</strong><small>{formatAppointmentDate(expense.expense_date)} · {expenseCategories.find((entry) => entry.value === expense.category)?.label ?? expense.category}{expense.source === "INVENTORY" ? " · 库存采购" : ""}</small></span><strong>{formatMoney(expense.amount)}</strong>
            </button>) : <p className="empty-state">本月暂无支出。</p>}
        </div>}
        {selected !== undefined && <BottomSheet title={selected ? "编辑支出" : "新增支出"} onClose={() => setSelected(undefined)}>
            <div className="sheet-form"><div className="form-card">
                <label>日期<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
                <label>类别<select value={category} onChange={(event) => setCategory(event.target.value as ExpenseCategory)} required>
                    {expenseCategories.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
                </select></label>
                <label>物品<input value={item} onChange={(event) => setItem(event.target.value)} maxLength={100} required /></label>
                <label>金额（RM）<input type="number" min="0" step="0.01" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
                <label>备注<textarea rows={2} value={remark} onChange={(event) => setRemark(event.target.value)} /></label>
                {selected?.source === "INVENTORY" && <p className="form-hint">此支出由库存采购自动生成，编辑支出不会改变库存记录。</p>}
            </div>{formError && <p className="form-error" role="alert">{formError}</p>}
                <button className="primary-button" type="button" onClick={save} disabled={saving}>{saving ? "保存中..." : "保存支出"}</button>
                {selected && <button className="danger-button" type="button" onClick={remove} disabled={saving}>删除支出</button>}
            </div>
        </BottomSheet>}
    </main>;
}

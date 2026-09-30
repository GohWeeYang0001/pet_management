import { useEffect, useState } from "react";
import BottomSheet from "../components/sheets/BottomSheet";
import { createInventoryItem, getInventory, getInventoryTransactions, stockIn, stockOut, updateInventoryItem } from "../services/inventoryService";
import type { InventoryItem, InventoryTransaction } from "../types/inventory";
import { formatMoney } from "../utils/appointmentFormat";
import { todayDateOnly } from "../utils/month";

type Mode = "add" | "detail" | "edit" | "in" | "out" | null;
export default function InventoryPage() {
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [selected, setSelected] = useState<InventoryItem | null>(null);
    const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
    const [mode, setMode] = useState<Mode>(null);
    const [name, setName] = useState(""); const [unit, setUnit] = useState("unit");
    const [quantity, setQuantity] = useState(""); const [reorder, setReorder] = useState("0");
    const [amount, setAmount] = useState(""); const [remark, setRemark] = useState("");
    const [expenseDate, setExpenseDate] = useState(todayDateOnly()); const [active, setActive] = useState(true);
    const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
    const [error, setError] = useState(""); const [formError, setFormError] = useState("");
    useEffect(() => { getInventory().then(setItems).catch(() => setError("Could not load inventory."))
        .finally(() => setLoading(false)); }, []);
    async function refresh(id?: string) {
        const data = await getInventory(); setItems(data);
        if (id) setSelected(data.find((item) => item.inventory_item_id === id) ?? null);
    }
    async function open(item: InventoryItem) {
        setSelected(item); setMode("detail"); setFormError(""); setTransactions([]);
        try { setTransactions(await getInventoryTransactions(item.inventory_item_id)); }
        catch { setFormError("Could not load stock transactions."); }
    }
    function start(next: Mode) {
        setMode(next); setFormError("");
        setName(next === "edit" ? selected?.item_name ?? "" : ""); setUnit(next === "edit" ? selected?.unit ?? "unit" : "unit");
        setReorder(next === "edit" ? String(selected?.reorder_level ?? 0) : "0"); setActive(selected?.is_active ?? true);
        setQuantity(next === "add" ? "0" : ""); setAmount(""); setRemark(""); setExpenseDate(todayDateOnly());
    }
    async function save() {
        setFormError("");
        const count = Number(quantity); const level = Number(reorder); const cost = amount === "" ? null : Number(amount);
        if ((mode === "add" || mode === "edit") && (!name.trim() || !unit.trim() || !Number.isFinite(level) || level < 0 || (mode === "add" && (!Number.isFinite(count) || count < 0)))) {
            setFormError("Name, unit and valid non-negative quantities are required."); return;
        }
        if ((mode === "in" || mode === "out") && (!quantity || !Number.isFinite(count) || count <= 0 || (mode === "in" && cost !== null && (!Number.isFinite(cost) || cost < 0)))) {
            setFormError("Enter a positive quantity and a valid optional purchase cost."); return;
        }
        setSaving(true);
        try {
            if (mode === "add") {
                await createInventoryItem({ item_name: name.trim(), unit: unit.trim(), current_quantity: count, reorder_level: level });
                await refresh(); setMode(null);
            } else if (selected) {
                const id = selected.inventory_item_id;
                if (mode === "edit") await updateInventoryItem(id, { item_name: name.trim(), unit: unit.trim(), reorder_level: level, is_active: active });
                if (mode === "in") await stockIn(id, { quantity: count, amount: cost, remark: remark.trim() || null, expense_date: expenseDate });
                if (mode === "out") await stockOut(id, { quantity: count, remark: remark.trim() || null });
                await refresh(id); setTransactions(await getInventoryTransactions(id)); setMode("detail");
            }
        } catch (failure) { console.error(failure); setFormError("Could not save stock change. Check available quantity and try again."); }
        finally { setSaving(false); }
    }
    const low = (item: InventoryItem) => Number(item.current_quantity) <= Number(item.reorder_level);
    return <main className="business-page">
        <button className="primary-button" type="button" onClick={() => start("add")}>+ Add Item</button>
        {error && <p className="form-error" role="alert">{error}</p>}
        {loading ? <p className="form-hint">Loading inventory...</p> : <div className="business-list">
            {items.length ? items.map((item) => <button type="button" className={`business-row ${low(item) ? "low-stock" : ""}`} key={item.inventory_item_id} onClick={() => open(item)}>
                <span><strong>{item.item_name}</strong><small>{item.current_quantity} {item.unit} · Reorder at {item.reorder_level}{item.is_active ? "" : " · Inactive"}</small></span>
                <span>{low(item) ? <b className="low-badge">LOW STOCK</b> : "›"}</span>
            </button>) : <p className="empty-state">No inventory items yet.</p>}
        </div>}
        {mode && <BottomSheet title={{ add: "Add Item", detail: selected?.item_name ?? "Item", edit: "Edit Item", in: "Restock", out: "Stock Out" }[mode]} onClose={() => setMode(null)}>
            {mode === "detail" && selected ? <div className="sheet-form">
                <div className="detail-summary"><h3>{selected.item_name}</h3><p>{selected.current_quantity} {selected.unit} in stock · Reorder at {selected.reorder_level}</p>{low(selected) && <b className="low-badge">LOW STOCK</b>}</div>
                <div className="action-grid"><button className="secondary-button" type="button" onClick={() => start("in")}>Restock</button><button className="secondary-button" type="button" onClick={() => start("out")}>Stock Out</button></div>
                <button className="secondary-button" type="button" onClick={() => start("edit")}>Edit Item</button>
                <h3 className="section-heading">Recent stock transactions</h3>
                {transactions.length ? transactions.map((entry) => <div className="form-card" key={entry.inventory_transaction_id}>
                    <div className="split-line"><strong>{entry.transaction_type.replace("_", " ")}</strong><strong>{entry.quantity} {selected.unit}</strong></div>
                    <small>{entry.created_at.slice(0, 10)}{entry.amount == null ? "" : ` · ${formatMoney(entry.amount)}`}</small>
                    {entry.remark && <p className="compact-line">{entry.remark}</p>}
                </div>) : <p className="form-hint">No transactions yet.</p>}
                {formError && <p className="form-error" role="alert">{formError}</p>}
            </div> : <div className="sheet-form"><div className="form-card">
                {(mode === "add" || mode === "edit") && <>
                    <label>Item name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required /></label>
                    <label>Unit<input value={unit} onChange={(event) => setUnit(event.target.value)} maxLength={30} required /></label>
                    {mode === "add" && <label>Starting quantity<input type="number" min="0" step="0.01" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></label>}
                    <label>Reorder level<input type="number" min="0" step="0.01" value={reorder} onChange={(event) => setReorder(event.target.value)} required /></label>
                    {mode === "edit" && <label className="check-label"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> Active</label>}
                </>}
                {(mode === "in" || mode === "out") && <>
                    <label>Quantity ({selected?.unit})<input type="number" min="0.01" step="0.01" inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></label>
                    {mode === "in" && <><label>Purchase cost (RM, optional)<input type="number" min="0" step="0.01" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
                        <label>Expense date<input type="date" value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} /></label>
                        <p className="form-hint">A purchase cost automatically creates an INVENTORY expense.</p></>}
                    <label>Remark<textarea rows={2} value={remark} onChange={(event) => setRemark(event.target.value)} /></label>
                </>}
            </div>{formError && <p className="form-error" role="alert">{formError}</p>}
                <button className="primary-button" type="button" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</button>
                {mode !== "add" && <button className="secondary-button" type="button" onClick={() => setMode("detail")} disabled={saving}>Back to item</button>}
            </div>}
        </BottomSheet>}
    </main>;
}

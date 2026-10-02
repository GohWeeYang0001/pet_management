import { useEffect, useState } from "react";
import BottomSheet from "../components/sheets/BottomSheet";
import { createInventoryItem, getInventory, getInventoryTransactions, stockIn, stockOut, updateInventoryItem } from "../services/inventoryService";
import type { InventoryItem, InventoryTransaction } from "../types/inventory";
import { inventoryTransactionLabels, displayUnit } from "../utils/displayLabels";
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
    useEffect(() => { getInventory().then(setItems).catch(() => setError("库存加载失败。"))
        .finally(() => setLoading(false)); }, []);
    async function refresh(id?: string) {
        const data = await getInventory(); setItems(data);
        if (id) setSelected(data.find((item) => item.inventory_item_id === id) ?? null);
    }
    async function open(item: InventoryItem) {
        setSelected(item); setMode("detail"); setFormError(""); setTransactions([]);
        try { setTransactions(await getInventoryTransactions(item.inventory_item_id)); }
        catch { setFormError("库存记录加载失败。"); }
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
            setFormError("请填写名称、单位及有效的非负数量。"); return;
        }
        if ((mode === "in" || mode === "out") && (!quantity || !Number.isFinite(count) || count <= 0 || (mode === "in" && cost !== null && (!Number.isFinite(cost) || cost < 0)))) {
            setFormError("请输入大于零的数量；如填写采购成本，须为有效的非负金额。"); return;
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
        } catch (failure) { console.error(failure); setFormError("库存变更保存失败，请检查可用数量后重试。"); }
        finally { setSaving(false); }
    }
    const low = (item: InventoryItem) => Number(item.current_quantity) <= Number(item.reorder_level);
    return <main className="business-page">
        <button className="primary-button" type="button" onClick={() => start("add")}>+ 新增物品</button>
        {error && <p className="form-error" role="alert">{error}</p>}
        {loading ? <p className="form-hint">库存加载中...</p> : <div className="business-list">
            {items.length ? items.map((item) => <button type="button" className={`business-row ${low(item) ? "low-stock" : ""}`} key={item.inventory_item_id} onClick={() => open(item)}>
                <span><strong>{item.item_name}</strong><small>{item.current_quantity} {displayUnit(item.unit)} · 补货提醒数量： {item.reorder_level}{item.is_active ? "" : " · 已停用"}</small></span>
                <span>{low(item) ? <b className="low-badge">库存不足</b> : "›"}</span>
            </button>) : <p className="empty-state">暂无库存物品。</p>}
        </div>}
        {mode && <BottomSheet title={{ add: "新增物品", detail: selected?.item_name ?? "物品", edit: "编辑物品", in: "补货", out: "出库" }[mode]} onClose={() => setMode(null)}>
            {mode === "detail" && selected ? <div className="sheet-form">
                <div className="detail-summary"><h3>{selected.item_name}</h3><p>{selected.current_quantity} {displayUnit(selected.unit)} 库存 · 补货提醒数量： {selected.reorder_level}</p>{low(selected) && <b className="low-badge">库存不足</b>}</div>
                <div className="action-grid"><button className="secondary-button" type="button" onClick={() => start("in")}>补货</button><button className="secondary-button" type="button" onClick={() => start("out")}>出库</button></div>
                <button className="secondary-button" type="button" onClick={() => start("edit")}>编辑物品</button>
                <h3 className="section-heading">近期库存记录</h3>
                {transactions.length ? transactions.map((entry) => <div className="form-card" key={entry.inventory_transaction_id}>
                    <div className="split-line"><strong>{inventoryTransactionLabels[entry.transaction_type]}</strong><strong>{entry.quantity} {displayUnit(selected.unit)}</strong></div>
                    <small>{entry.created_at.slice(0, 10)}{entry.amount == null ? "" : ` · ${formatMoney(entry.amount)}`}</small>
                    {entry.remark && <p className="compact-line">{entry.remark}</p>}
                </div>) : <p className="form-hint">暂无库存记录。</p>}
                {formError && <p className="form-error" role="alert">{formError}</p>}
            </div> : <div className="sheet-form"><div className="form-card">
                {(mode === "add" || mode === "edit") && <>
                    <label>物品名称<input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required /></label>
                    <label>单位<input value={unit} onChange={(event) => setUnit(event.target.value)} maxLength={30} required /></label>
                    {mode === "add" && <label>初始库存<input type="number" min="0" step="0.01" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></label>}
                    <label>补货提醒数量<input type="number" min="0" step="0.01" value={reorder} onChange={(event) => setReorder(event.target.value)} required /></label>
                    {mode === "edit" && <label className="check-label"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> 启用</label>}
                </>}
                {(mode === "in" || mode === "out") && <>
                    <label>数量（{displayUnit(selected?.unit ?? "")}）<input type="number" min="0.01" step="0.01" inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></label>
                    {mode === "in" && <><label>采购成本（RM，可选）<input type="number" min="0" step="0.01" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
                        <label>支出日期<input type="date" value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} /></label>
                        <p className="form-hint">填写采购成本后，将自动生成库存类别的支出。</p></>}
                    <label>备注<textarea rows={2} value={remark} onChange={(event) => setRemark(event.target.value)} /></label>
                </>}
            </div>{formError && <p className="form-error" role="alert">{formError}</p>}
                <button className="primary-button" type="button" onClick={save} disabled={saving}>{saving ? "保存中..." : "保存"}</button>
                {mode !== "add" && <button className="secondary-button" type="button" onClick={() => setMode("detail")} disabled={saving}>返回物品详情</button>}
            </div>}
        </BottomSheet>}
    </main>;
}

import { useEffect, useState } from "react";
import BottomSheet from "../components/sheets/BottomSheet";
import { createTravelFeeOption, getTravelFeeOptions, updateTravelFeeOption } from "../services/travelFeeService";
import type { TravelFeeOption } from "../types/travelFee";
import { parseMoneyInput } from "../utils/businessV2";
import { formatMoney } from "../utils/appointmentFormat";

export default function TravelFeesPage() {
    const [options,setOptions] = useState<TravelFeeOption[]>([]);
    const [selected,setSelected] = useState<TravelFeeOption | null | undefined>(undefined);
    const [label,setLabel] = useState("");
    const [amount,setAmount] = useState("");
    const [manual,setManual] = useState(false);
    const [active,setActive] = useState(true);
    const [order,setOrder] = useState("0");
    const [loading,setLoading] = useState(true);
    const [saving,setSaving] = useState(false);
    const [error,setError] = useState("");
    const [formError,setFormError] = useState("");
    async function load() {
        setLoading(true); setError("");
        try { setOptions(await getTravelFeeOptions(true)); }
        catch { setError("交通费选项加载失败，请重试。"); }
        finally { setLoading(false); }
    }
    useEffect(() => {
        let current = true;
        getTravelFeeOptions(true).then(data => { if (current) setOptions(data); })
            .catch(() => { if (current) setError("交通费选项加载失败，请重试。"); })
            .finally(() => { if (current) setLoading(false); });
        return () => { current = false; };
    },[]);
    function open(option: TravelFeeOption | null) {
        setSelected(option); setFormError(""); setLabel(option?.label ?? "");
        setManual(!!option && option.amount === null); setAmount(option?.amount == null ? "" : String(option.amount));
        setActive(option?.is_active ?? true); setOrder(String(option?.sort_order ?? 0));
    }
    async function save() {
        if (saving) return;
        const price = manual ? null : parseMoneyInput(amount);
        const position = Number(order);
        if (!label.trim() || label.trim().length > 100 || (!manual && price === null)
            || !/^\d+$/.test(order) || !Number.isInteger(position) || position > 1000000) {
            setFormError("请填写标签、有效金额及排序（0–1000000），金额最多两位小数。"); return;
        }
        setSaving(true); setFormError("");
        try {
            const input = {label:label.trim(),amount:price,is_active:active,sort_order:position};
            const saved = selected ? await updateTravelFeeOption(selected.travel_fee_option_id,input) : await createTravelFeeOption(input);
            setOptions(current => [...current.filter(option => option.travel_fee_option_id !== saved.travel_fee_option_id),saved]
                .sort((a,b) => a.sort_order-b.sort_order || Number(a.travel_fee_option_id)-Number(b.travel_fee_option_id)));
            setSelected(undefined);
        } catch { setFormError("交通费选项保存失败，请重试。"); }
        finally { setSaving(false); }
    }
    return <main className="business-page">
        <p className="form-hint">选项仅用于快速填写交通费，修改选项不会改变已有预约的金额。</p>
        <button className="primary-button" type="button" onClick={() => open(null)}>+ 新增交通费选项</button>
        {error && <div><p className="form-error" role="alert">{error}</p><button className="text-button" type="button" onClick={load}>重试</button></div>}
        {loading ? <p className="form-hint">交通费选项加载中...</p> : <div className="business-list">{options.map(option =>
            <button type="button" className="business-row" key={option.travel_fee_option_id} onClick={() => open(option)}>
                <span><strong>{option.label}</strong><small>{option.is_active ? "启用" : "停用"} · 排序 {option.sort_order}</small></span>
                <strong>{option.amount === null ? "手动输入" : formatMoney(option.amount)}</strong>
            </button>)}{!options.length && <p className="form-hint">暂无交通费选项。</p>}</div>}
        {selected !== undefined && <BottomSheet title={selected ? "编辑交通费选项" : "新增交通费选项"} onClose={() => setSelected(undefined)}>
            <div className="sheet-form"><fieldset className="form-card" disabled={saving}>
                <label>标签<input value={label} maxLength={100} required onChange={event => setLabel(event.target.value)} /></label>
                <label className="check-label"><input type="checkbox" checked={manual} onChange={event => setManual(event.target.checked)} /> 手动输入金额</label>
                {manual ? <p className="form-hint">选择此选项时，由员工在预约中填写实际交通费。</p> :
                    <label>金额（RM）<input type="number" min="0" max="99999999.99" step="0.01" inputMode="decimal" required value={amount} onChange={event => setAmount(event.target.value)} /></label>}
                <label>排序<input type="number" min="0" max="1000000" step="1" value={order} onChange={event => setOrder(event.target.value)} /></label>
                <label className="check-label"><input type="checkbox" checked={active} onChange={event => setActive(event.target.checked)} /> 启用（取消勾选为停用）</label>
            </fieldset>{formError && <p className="form-error" role="alert">{formError}</p>}
                <button className="primary-button" type="button" disabled={saving} onClick={save}>{saving ? "保存中..." : "保存交通费选项"}</button>
            </div>
        </BottomSheet>}
    </main>;
}

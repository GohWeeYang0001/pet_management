import { useEffect, useState } from "react";
import BottomSheet from "../components/sheets/BottomSheet";
import { createService, getServices, updateService } from "../services/serviceService";
import type { Service, ServiceKind } from "../types/service";
import { ApiError } from "../services/api";
import { serviceKindLabels } from "../utils/displayLabels";
import { parseMoneyInput } from "../utils/businessV2";
import { formatMoney } from "../utils/appointmentFormat";

export default function ServicesPage() {
    const [services, setServices] = useState<Service[]>([]);
    const [selected, setSelected] = useState<Service | null | undefined>(undefined);
    const [name, setName] = useState("");
    const [price, setPrice] = useState("");
    const [active, setActive] = useState(true);
    const [kind,setKind] = useState<ServiceKind>("BASE");
    const [filter,setFilter] = useState<ServiceKind | "ALL">("ALL");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [formError, setFormError] = useState("");
    useEffect(() => {
        getServices(true).then(setServices).catch(() => setError("服务加载失败。"))
            .finally(() => setLoading(false));
    }, []);
    function open(service: Service | null) {
        setSelected(service); setFormError(""); setName(service?.service_name ?? "");
        setPrice(service?.default_price == null ? "" : String(service.default_price)); setActive(service?.is_active ?? true);
        setKind(service?.service_kind ?? "BASE");
    }
    async function save() {
        if (saving) return;
        const amount = parseMoneyInput(price);
        if (!name.trim() || amount === null) { setFormError("请填写名称及有效非负价格，最多两位小数且不超过 RM99,999,999.99。"); return; }
        setSaving(true); setFormError("");
        try {
            const input = { service_name:name.trim(),default_price:amount,service_kind:kind };
            let saved: Service;
            if (selected) saved = await updateService(selected.service_id,{ ...input,is_active:active });
            else {
                saved = await createService(input);
                // POST creates active entries. Use the existing PUT contract for a new inactive entry.
                setSelected(saved);
                setServices(current => [...current,saved]);
                if (!active) saved = await updateService(saved.service_id,{ ...input,is_active:false });
            }
            setServices(current => current.some(service => service.service_id === saved.service_id)
                ? current.map(service => service.service_id === saved.service_id ? saved : service) : [...current,saved]);
            setSelected(undefined);
        } catch (failure) {
            console.error(failure);
            setFormError(failure instanceof ApiError && failure.status === 409
                ? "此服务已用于预约，不能更改服务类型。" : "服务保存失败，请重试；已新增的服务可继续编辑。");
        }
        finally { setSaving(false); }
    }
    return <main className="business-page">
        <button className="primary-button" type="button" onClick={() => open(null)}>+ 新增服务</button>
        <div className="v2-service-filters" aria-label="服务类型筛选">{(["ALL","BASE","ADDON"] as const).map(value =>
            <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === "ALL" ? "全部" : serviceKindLabels[value]}</button>)}</div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {loading ? <p className="form-hint">服务加载中...</p> : <div className="business-list">{services.filter(service => filter === "ALL" || service.service_kind === filter).map((service) => <button type="button" className="business-row" key={service.service_id} onClick={() => open(service)}>
            <span><strong>{service.service_name}</strong><small>{serviceKindLabels[service.service_kind]} · {service.is_active ? "启用" : "停用"}</small></span><strong>{formatMoney(service.default_price)}</strong>
        </button>)}</div>}
        {selected !== undefined && <BottomSheet title={selected ? "编辑服务" : "新增服务"} onClose={() => setSelected(undefined)}>
            <div className="sheet-form"><fieldset className="form-card" disabled={saving}>
                <label>服务名称<input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required /></label>
                <label>服务类型<select value={kind} onChange={event => setKind(event.target.value as ServiceKind)}>
                    <option value="BASE">基础服务</option><option value="ADDON">加购项目</option>
                </select></label>
                <label>默认价格（RM）<input type="number" min="0" step="0.01" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} required /></label>
                <label className="check-label"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> 启用（取消勾选为停用）</label>
                {selected && <p className="form-hint">已用于预约的服务不能更改基础／加购类型。</p>}
            </fieldset>{formError && <p className="form-error" role="alert">{formError}</p>}
                <button className="primary-button" type="button" disabled={saving} onClick={save}>{saving ? "保存中..." : "保存服务"}</button>
            </div>
        </BottomSheet>}
    </main>;
}

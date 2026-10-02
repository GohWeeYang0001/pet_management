import { useEffect, useState } from "react";
import BottomSheet from "../components/sheets/BottomSheet";
import PetFormSheet from "../components/sheets/PetFormSheet";
import { createCustomer, getCustomerOverview, getCustomers, updateCustomer } from "../services/customerService";
import type { Customer, CustomerOverview } from "../types/customer";
import { appointmentStatusLabels, displayPetType } from "../utils/displayLabels";
import { formatAppointmentDate, formatAppointmentTime, formatMoney } from "../utils/appointmentFormat";

export default function CustomersPage() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState<Customer | null>(null);
    const [overview, setOverview] = useState<CustomerOverview | null>(null);
    const [mode, setMode] = useState<"add" | "edit" | null>(null);
    const [petForm, setPetForm] = useState<"add" | CustomerOverview["pets"][number] | null>(null);
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [formError, setFormError] = useState("");

    useEffect(() => {
        let current = true;
        const timer = window.setTimeout(() => {
            setLoading(true);
            getCustomers(search).then((data) => { if (current) { setCustomers(data); setError(""); } })
                .catch(() => { if (current) setError("客户加载失败，请重新搜索。"); })
                .finally(() => { if (current) setLoading(false); });
        }, search ? 250 : 0);
        return () => { current = false; window.clearTimeout(timer); };
    }, [search]);

    async function refresh() { setCustomers(await getCustomers(search)); }

    async function openCustomer(customer: Customer) {
        setSelected(customer); setOverview(null); setError("");
        try { setOverview(await getCustomerOverview(customer.customer_id)); }
        catch { setError("客户资料加载失败，请关闭后重试。"); }
    }

    function openForm(nextMode: "add" | "edit") {
        setMode(nextMode); setFormError("");
        setName(nextMode === "edit" ? selected?.customer_name ?? "" : "");
        setPhone(nextMode === "edit" ? selected?.customer_hp ?? "" : "");
    }

    async function save() {
        if (!name.trim() || !phone.trim()) { setFormError("请填写姓名和电话号码。"); return; }
        setSaving(true); setFormError("");
        try {
            const saved = mode === "edit" && selected
                ? await updateCustomer(selected.customer_id, name.trim(), phone.trim())
                : await createCustomer(name.trim(), phone.trim());
            await refresh();
            setMode(null);
            if (selected) { setSelected(saved); setOverview(await getCustomerOverview(saved.customer_id)); }
        } catch (failure) { console.error(failure); setFormError("客户保存失败，请检查资料后重试。"); }
        finally { setSaving(false); }
    }

    async function refreshOverview() {
        if (!selected) return;
        setOverview(await getCustomerOverview(selected.customer_id));
        await refresh();
        setPetForm(null);
    }

    return <>
        <header className="page-header"><p className="page-eyebrow">宠物管理</p><h1 className="page-title">客户</h1></header>
        <main className="business-page">
            <label className="search-label">按姓名或电话号码搜索<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索客户" /></label>
            <button className="primary-button" type="button" onClick={() => openForm("add")}>+ 新增客户</button>
            {error && <p className="form-error" role="alert">{error}</p>}
            {loading ? <p className="form-hint">客户加载中...</p> : <div className="business-list">
                {customers.length === 0 && <p className="empty-state">找不到客户。</p>}
                {customers.map((customer) => <button className="business-row" key={customer.customer_id} type="button" onClick={() => openCustomer(customer)}>
                    <span><strong>{customer.customer_name}</strong><small>{customer.customer_hp} · {customer.pet_count ?? 0} 只宠物</small></span><span aria-hidden="true">›</span>
                </button>)}
            </div>}
        </main>
        {selected && !mode && !petForm && <BottomSheet title="客户资料" subtitle={selected.customer_name} onClose={() => { setSelected(null); setOverview(null); }}>
            {!overview ? <p className={error ? "form-error" : "form-hint"} role={error ? "alert" : undefined}>{error || "资料加载中..."}</p> : <div className="sheet-form">
                <div className="detail-summary"><h3>{overview.customer.customer_name}</h3><a href={`tel:${overview.customer.customer_hp}`}>{overview.customer.customer_hp}</a></div>
                <button className="secondary-button" type="button" onClick={() => openForm("edit")}>编辑客户</button>
                <div className="summary-grid"><div className="summary-card"><small>已完成到店次数</small><strong>{overview.completed_visits}</strong></div><div className="summary-card"><small>累计消费</small><strong>{formatMoney(overview.total_spending)}</strong></div></div>
                <div className="form-card"><h3>宠物</h3>{overview.pets.length ? overview.pets.map((pet) => <div className="pet-management-row" key={pet.pet_id}>
                    <div><strong>{pet.pet_name}</strong><p>{displayPetType(pet.pet_type) || "未填写类型"}</p><p>{pet.pet_remark || "暂无备注"}</p></div>
                    <button className="text-button" type="button" onClick={() => setPetForm(pet)}>编辑</button>
                </div>) : <p className="form-hint">暂无宠物。</p>}
                    <button className="text-button" type="button" onClick={() => setPetForm("add")}>+ 添加宠物</button>
                </div>
                <h3 className="section-heading">预约记录</h3>
                {overview.appointment_history.length ? overview.appointment_history.map((entry) => <div className="form-card" key={entry.appointment_id}>
                    <div className="split-line"><strong>{formatAppointmentDate(entry.appointment_date)} · {formatAppointmentTime(entry.start_time)}</strong><span className={`status-badge status-${entry.status.toLowerCase()}`}>{appointmentStatusLabels[entry.status]}</span></div>
                    {entry.pets.map((pet, index) => <p className="compact-line" key={index}>{pet.pet_name} · {pet.service_name}{pet.amount === null ? "" : ` · ${formatMoney(pet.amount)}`}</p>)}
                    <p className="compact-line">总计： {entry.status === "COMPLETED" ? formatMoney(entry.amount) : "尚未收费"}</p>
                </div>) : <p className="form-hint">暂无预约记录。</p>}
            </div>}
        </BottomSheet>}
        {selected && petForm && <PetFormSheet customerId={selected.customer_id} pet={petForm === "add" ? undefined : petForm}
            onClose={() => setPetForm(null)} onSaved={refreshOverview} />}
        {mode && <BottomSheet title={mode === "add" ? "新增客户" : "编辑客户"} onClose={() => setMode(null)}>
            <div className="sheet-form"><div className="form-card">
                <label>客户姓名<input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required /></label>
                <label>电话号码<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={20} required /></label>
            </div>{formError && <p className="form-error" role="alert">{formError}</p>}
                <button className="primary-button" type="button" disabled={saving} onClick={save}>{saving ? "保存中..." : "保存客户"}</button>
            </div>
        </BottomSheet>}
    </>;
}

import { useEffect, useRef, useState } from "react";
import BottomSheet from "../components/sheets/BottomSheet";
import RecordActionSheet from "../components/customers/RecordActionSheet";
import PetFormSheet from "../components/sheets/PetFormSheet";
import CustomerAddresses from "../components/addresses/CustomerAddresses";
import CustomerAppointmentHistory from "../components/customers/CustomerAppointmentHistory";
import { createCustomerHistoryStore } from "../utils/customerHistoryStore";
import { createCustomer, getCustomerOverview, getCustomers, updateCustomer } from "../services/customerService";
import type { Customer, CustomerOverview } from "../types/customer";
import { displayPetType } from "../utils/displayLabels";
import { formatMoney } from "../utils/appointmentFormat";

export default function CustomersPage() {
    const [historyStore] = useState(() => createCustomerHistoryStore());
    const overviewGeneration = useRef(0);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [includeArchived,setIncludeArchived]=useState(false);
    const [recordAction,setRecordAction]=useState<{petId?:string;restore:boolean}|null>(null);
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
            getCustomers(search,includeArchived).then((data) => { if (current) { setCustomers(data); setError(""); } })
                .catch(() => { if (current) setError("客户加载失败，请重新搜索。"); })
                .finally(() => { if (current) setLoading(false); });
        }, search ? 250 : 0);
        return () => { current = false; window.clearTimeout(timer); };
    }, [search,includeArchived]);

    async function refresh() { setCustomers(await getCustomers(search)); }

    async function openCustomer(customer: Customer) {
        const generation = ++overviewGeneration.current;
        setSelected(customer); setOverview(null); setError("");
        try { const data=await getCustomerOverview(customer.customer_id); if (generation === overviewGeneration.current) setOverview(data); }
        catch { if (generation === overviewGeneration.current) setError("客户资料加载失败，请关闭后重试。"); }
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
            if (selected) { historyStore.invalidate(selected.customer_id); setSelected(saved); setOverview(await getCustomerOverview(saved.customer_id)); }
        } catch (failure) { console.error(failure); setFormError("客户保存失败，请检查资料后重试。"); }
        finally { setSaving(false); }
    }

    async function refreshOverview() {
        if (!selected) return;
        historyStore.invalidate(selected.customer_id);
        setOverview(await getCustomerOverview(selected.customer_id));
        await refresh();
        setPetForm(null);
    }

    async function afterRecordAction(deletedCustomer:boolean) {
        if(!selected)return;
        historyStore.invalidate(selected.customer_id);
        if(deletedCustomer){overviewGeneration.current++;setSelected(null);setOverview(null);}
        else {const data=await getCustomerOverview(selected.customer_id);setOverview(data);setSelected(data.customer);}
        await refresh();setRecordAction(null);
    }
    return <>
        <header className="page-header"><p className="page-eyebrow">宠物管理</p><h1 className="page-title">客户</h1></header>
        <main className="business-page">
            <label className="search-label">按姓名或电话号码搜索<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索客户" /></label>
            <label className="check-label customer-archive-filter"><input type="checkbox" checked={includeArchived} onChange={event=>setIncludeArchived(event.target.checked)} /> 显示已归档客户</label>
            <button className="primary-button" type="button" onClick={() => openForm("add")}>+ 新增客户</button>
            {error && <p className="form-error" role="alert">{error}</p>}
            {loading ? <p className="form-hint">客户加载中...</p> : <div className="business-list">
                {customers.length === 0 && <p className="empty-state">找不到客户。</p>}
                {customers.map((customer) => <button className="business-row" key={customer.customer_id} type="button" onClick={() => openCustomer(customer)}>
                    <span><strong>{customer.customer_name}{customer.is_archived&&<span className="record-tag">已归档</span>}</strong><small>{customer.customer_hp} · {customer.pet_count ?? 0} 只宠物</small></span><span aria-hidden="true">›</span>
                </button>)}
            </div>}
        </main>
        {selected && !mode && !petForm && !recordAction && <BottomSheet title="客户资料" subtitle={selected.customer_name} onClose={() => { overviewGeneration.current++; setSelected(null); setOverview(null); }}>
            {!overview ? <p className={error ? "form-error" : "form-hint"} role={error ? "alert" : undefined}>{error || "资料加载中..."}</p> : <div className="sheet-form">
                <div className="detail-summary"><h3>{overview.customer.customer_name}{overview.customer.is_archived&&<span className="record-tag">已归档</span>}</h3><a href={`tel:${overview.customer.customer_hp}`}>{overview.customer.customer_hp}</a></div>
                <button className="secondary-button" type="button" onClick={() => openForm("edit")}>编辑客户</button>
                <div className="record-actions">
                    {(overview.customer.can_delete===true || (!overview.customer.is_archived && overview.customer.can_delete===false))&&<button type="button" className={overview.customer.can_delete?"danger-button":"secondary-button"} onClick={()=>setRecordAction({restore:false})}>{overview.customer.can_delete?"删除客户":"归档客户"}</button>}
                    {overview.customer.is_archived&&<button type="button" className="secondary-button" onClick={()=>setRecordAction({restore:true})}>恢复客户</button>}
                </div>
                {overview.customer.has_appointment_history&&!overview.customer.is_archived&&<p className="form-hint">该客户已有预约记录，无法永久删除，可以归档。</p>}
                <div className="summary-grid"><div className="summary-card"><small>已完成到店次数</small><strong>{overview.completed_visits}</strong></div><div className="summary-card"><small>累计消费</small><strong>{formatMoney(overview.total_spending)}</strong></div></div>
                <div className="form-card"><h3>宠物</h3>{overview.pets.length ? overview.pets.map((pet) => <div className="pet-management-row" key={pet.pet_id}>
                    <div><strong>{pet.pet_name}{pet.is_archived&&<span className="record-tag">已归档</span>}</strong><p>品种：{displayPetType(pet.pet_type) || "未填写"}</p><p>{pet.pet_remark || "暂无备注"}</p></div>
                    <div className="record-actions"><button className="text-button" type="button" onClick={() => setPetForm(pet)}>编辑宠物</button>
                        {(pet.can_delete===true || (!pet.is_archived && pet.can_delete===false))&&<button className={pet.can_delete?"text-button record-danger":"text-button"} type="button" onClick={()=>setRecordAction({petId:pet.pet_id,restore:false})}>{pet.can_delete?"删除宠物":"归档宠物"}</button>}
                        {pet.is_archived&&<button className="text-button" type="button" onClick={()=>setRecordAction({petId:pet.pet_id,restore:true})}>恢复宠物</button>}</div>
                </div>) : <p className="form-hint">暂无宠物。</p>}
                    <button className="text-button" type="button" onClick={() => setPetForm("add")}>+ 添加宠物</button>
                </div>
                <CustomerAddresses key={selected.customer_id} customerId={selected.customer_id} />
                <CustomerAppointmentHistory key={`history-${selected.customer_id}`} customerId={selected.customer_id} store={historyStore} />
            </div>}
        </BottomSheet>}
        {selected&&recordAction&&<RecordActionSheet customerId={selected.customer_id} petId={recordAction.petId} restore={recordAction.restore} onClose={()=>setRecordAction(null)} onSuccess={afterRecordAction} />}
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

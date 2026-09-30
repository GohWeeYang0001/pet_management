import { useEffect, useState } from "react";
import BottomSheet from "../components/sheets/BottomSheet";
import PetFormSheet from "../components/sheets/PetFormSheet";
import { createCustomer, getCustomerOverview, getCustomers, updateCustomer } from "../services/customerService";
import type { Customer, CustomerOverview } from "../types/customer";
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
                .catch(() => { if (current) setError("Could not load customers. Try searching again."); })
                .finally(() => { if (current) setLoading(false); });
        }, search ? 250 : 0);
        return () => { current = false; window.clearTimeout(timer); };
    }, [search]);

    async function refresh() { setCustomers(await getCustomers(search)); }

    async function openCustomer(customer: Customer) {
        setSelected(customer); setOverview(null); setError("");
        try { setOverview(await getCustomerOverview(customer.customer_id)); }
        catch { setError("Could not load customer details. Close and try again."); }
    }

    function openForm(nextMode: "add" | "edit") {
        setMode(nextMode); setFormError("");
        setName(nextMode === "edit" ? selected?.customer_name ?? "" : "");
        setPhone(nextMode === "edit" ? selected?.customer_hp ?? "" : "");
    }

    async function save() {
        if (!name.trim() || !phone.trim()) { setFormError("Name and phone are required."); return; }
        setSaving(true); setFormError("");
        try {
            const saved = mode === "edit" && selected
                ? await updateCustomer(selected.customer_id, name.trim(), phone.trim())
                : await createCustomer(name.trim(), phone.trim());
            await refresh();
            setMode(null);
            if (selected) { setSelected(saved); setOverview(await getCustomerOverview(saved.customer_id)); }
        } catch (failure) { console.error(failure); setFormError("Could not save customer. Please check the details and try again."); }
        finally { setSaving(false); }
    }

    async function refreshOverview() {
        if (!selected) return;
        setOverview(await getCustomerOverview(selected.customer_id));
        await refresh();
        setPetForm(null);
    }

    return <>
        <header className="page-header"><p className="page-eyebrow">Pet Management</p><h1 className="page-title">Customers</h1></header>
        <main className="business-page">
            <label className="search-label">Search by name or phone<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customers" /></label>
            <button className="primary-button" type="button" onClick={() => openForm("add")}>+ Add Customer</button>
            {error && <p className="form-error" role="alert">{error}</p>}
            {loading ? <p className="form-hint">Loading customers...</p> : <div className="business-list">
                {customers.length === 0 && <p className="empty-state">No customers found.</p>}
                {customers.map((customer) => <button className="business-row" key={customer.customer_id} type="button" onClick={() => openCustomer(customer)}>
                    <span><strong>{customer.customer_name}</strong><small>{customer.customer_hp} · {customer.pet_count ?? 0} pets</small></span><span aria-hidden="true">›</span>
                </button>)}
            </div>}
        </main>
        {selected && !mode && !petForm && <BottomSheet title="Customer Details" subtitle={selected.customer_name} onClose={() => { setSelected(null); setOverview(null); }}>
            {!overview ? <p className={error ? "form-error" : "form-hint"} role={error ? "alert" : undefined}>{error || "Loading details..."}</p> : <div className="sheet-form">
                <div className="detail-summary"><h3>{overview.customer.customer_name}</h3><a href={`tel:${overview.customer.customer_hp}`}>{overview.customer.customer_hp}</a></div>
                <button className="secondary-button" type="button" onClick={() => openForm("edit")}>Edit Customer</button>
                <div className="summary-grid"><div className="summary-card"><small>Completed visits</small><strong>{overview.completed_visits}</strong></div><div className="summary-card"><small>Total spending</small><strong>{formatMoney(overview.total_spending)}</strong></div></div>
                <div className="form-card"><h3>Pets</h3>{overview.pets.length ? overview.pets.map((pet) => <div className="pet-management-row" key={pet.pet_id}>
                    <div><strong>{pet.pet_name}</strong><p>{pet.pet_type || "No type"}</p><p>{pet.pet_remark || "No remark"}</p></div>
                    <button className="text-button" type="button" onClick={() => setPetForm(pet)}>Edit</button>
                </div>) : <p className="form-hint">No pets yet.</p>}
                    <button className="text-button" type="button" onClick={() => setPetForm("add")}>+ Add Pet</button>
                </div>
                <h3 className="section-heading">Appointment history</h3>
                {overview.appointment_history.length ? overview.appointment_history.map((entry) => <div className="form-card" key={entry.appointment_id}>
                    <div className="split-line"><strong>{formatAppointmentDate(entry.appointment_date)} · {formatAppointmentTime(entry.start_time)}</strong><span className={`status-badge status-${entry.status.toLowerCase()}`}>{entry.status}</span></div>
                    {entry.pets.map((pet, index) => <p className="compact-line" key={index}>{pet.pet_name} · {pet.service_name}{pet.amount === null ? "" : ` · ${formatMoney(pet.amount)}`}</p>)}
                    <p className="compact-line">Total: {entry.status === "COMPLETED" ? formatMoney(entry.amount) : "Not charged"}</p>
                </div>) : <p className="form-hint">No appointments yet.</p>}
            </div>}
        </BottomSheet>}
        {selected && petForm && <PetFormSheet customerId={selected.customer_id} pet={petForm === "add" ? undefined : petForm}
            onClose={() => setPetForm(null)} onSaved={refreshOverview} />}
        {mode && <BottomSheet title={mode === "add" ? "Add Customer" : "Edit Customer"} onClose={() => setMode(null)}>
            <div className="sheet-form"><div className="form-card">
                <label>Name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required /></label>
                <label>Phone<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={20} required /></label>
            </div>{formError && <p className="form-error" role="alert">{formError}</p>}
                <button className="primary-button" type="button" disabled={saving} onClick={save}>{saving ? "Saving..." : "Save Customer"}</button>
            </div>
        </BottomSheet>}
    </>;
}

import { useEffect, useState } from "react";
import BottomSheet from "../components/sheets/BottomSheet";
import { createService, getServices, updateService } from "../services/serviceService";
import type { Service } from "../types/service";
import { formatMoney } from "../utils/appointmentFormat";

export default function ServicesPage() {
    const [services, setServices] = useState<Service[]>([]);
    const [selected, setSelected] = useState<Service | null | undefined>(undefined);
    const [name, setName] = useState("");
    const [price, setPrice] = useState("");
    const [active, setActive] = useState(true);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [formError, setFormError] = useState("");
    useEffect(() => {
        getServices(true).then(setServices).catch(() => setError("Could not load services."))
            .finally(() => setLoading(false));
    }, []);
    function open(service: Service | null) {
        setSelected(service); setFormError(""); setName(service?.service_name ?? "");
        setPrice(service?.default_price == null ? "" : String(service.default_price)); setActive(service?.is_active ?? true);
    }
    async function save() {
        const amount = Number(price);
        if (!name.trim() || price === "" || !Number.isFinite(amount) || amount < 0) { setFormError("Name and a valid non-negative price are required."); return; }
        setSaving(true); setFormError("");
        try {
            if (selected) await updateService(selected.service_id, name.trim(), amount, active);
            else await createService(name.trim(), amount);
            setServices(await getServices(true)); setSelected(undefined);
        } catch (failure) { console.error(failure); setFormError("Could not save service. Please try again."); }
        finally { setSaving(false); }
    }
    return <main className="business-page">
        <button className="primary-button" type="button" onClick={() => open(null)}>+ Add Service</button>
        {error && <p className="form-error" role="alert">{error}</p>}
        {loading ? <p className="form-hint">Loading services...</p> : <div className="business-list">{services.map((service) => <button type="button" className="business-row" key={service.service_id} onClick={() => open(service)}>
            <span><strong>{service.service_name}</strong><small>{service.is_active ? "Active" : "Inactive"}</small></span><strong>{formatMoney(service.default_price)}</strong>
        </button>)}</div>}
        {selected !== undefined && <BottomSheet title={selected ? "Edit Service" : "Add Service"} onClose={() => setSelected(undefined)}>
            <div className="sheet-form"><div className="form-card">
                <label>Name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required /></label>
                <label>Default price (RM)<input type="number" min="0" step="0.01" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} required /></label>
                {selected && <label className="check-label"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> Active</label>}
            </div>{formError && <p className="form-error" role="alert">{formError}</p>}
                <button className="primary-button" type="button" disabled={saving} onClick={save}>{saving ? "Saving..." : "Save Service"}</button>
            </div>
        </BottomSheet>}
    </main>;
}

import { useEffect, useState } from "react";
import { getCustomerAddresses, updateCustomerAddress } from "../../services/addressService";
import type { CustomerAddress } from "../../types/address";
import AddressForm from "./AddressForm";
import LocationDisplay from "./LocationDisplay";

export default function CustomerAddresses({ customerId }: { customerId: string }) {
    const [addresses,setAddresses] = useState<CustomerAddress[]>([]);
    const [loading,setLoading] = useState(true);
    const [busy,setBusy] = useState(false);
    const [error,setError] = useState("");
    const [form,setForm] = useState<CustomerAddress | null | undefined>(undefined);
    useEffect(() => {
        let current = true;
        getCustomerAddresses(customerId).then(data => { if (current) setAddresses(data); })
            .catch(() => { if (current) setError("地址加载失败，请重试。"); })
            .finally(() => { if (current) setLoading(false); });
        return () => { current = false; };
    },[customerId]);

    async function refresh() { setAddresses(await getCustomerAddresses(customerId)); setError(""); }
    async function retry() {
        setLoading(true);
        try { await refresh(); } catch { setError("地址加载失败，请重试。"); }
        finally { setLoading(false); }
    }
    async function update(address: CustomerAddress, fields: { is_default?: boolean; is_active?: boolean }) {
        setBusy(true); setError("");
        try { await updateCustomerAddress(customerId,address.address_id,{ label:address.label,...fields }); await refresh(); }
        catch { setError("地址设置失败，请重试。"); }
        finally { setBusy(false); }
    }
    return <section className="form-card" aria-label="客户地址">
        <div className="form-card-heading"><h3>地址</h3><button className="text-button" type="button" disabled={busy || loading} onClick={() => setForm(null)}>+ 新增地址</button></div>
        {loading ? <p className="form-hint">地址加载中...</p> : addresses.length === 0 && !error ? <p className="form-hint">未设置地址。</p> : null}
        {error && <div><p className="form-error" role="alert">{error}</p><button className="text-button" type="button" onClick={retry}>重试</button></div>}
        {addresses.map(address => <div className="v2-address-row" key={address.address_id}>
            <LocationDisplay location={address} />
            <p className="form-hint">{address.is_active ? address.is_default ? "默认地址 · 启用" : "启用" : "已停用"}</p>
            <div className="v2-actions">
                <button className="text-button" type="button" disabled={busy} onClick={() => setForm(address)}>编辑地址</button>
                {address.is_active && !address.is_default && <button className="text-button" type="button" disabled={busy} onClick={() => update(address,{ is_default:true })}>设为默认</button>}
                <button className="text-button" type="button" disabled={busy} onClick={() => update(address,{ is_active:!address.is_active })}>{address.is_active ? "停用地址" : "启用地址"}</button>
            </div>
        </div>)}
        {form !== undefined && <AddressForm key={form?.address_id ?? "new"} customerId={customerId} address={form ?? undefined}
            onCancel={() => setForm(undefined)} onSaved={async () => { await refresh(); setForm(undefined); }} />}
    </section>;
}

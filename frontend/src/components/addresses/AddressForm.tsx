import { useState } from "react";
import { createCustomerAddress, updateCustomerAddress } from "../../services/addressService";
import type { CustomerAddress } from "../../types/address";
import { validateAddressForm } from "../../utils/businessV2";

interface Props { customerId: string; address?: CustomerAddress; onCancel: () => void; onSaved: (address: CustomerAddress) => Promise<void> }

// Inline in an existing sheet: reuse the form without stacking or restructuring BottomSheets.
export default function AddressForm({ customerId, address, onCancel, onSaved }: Props) {
    const [label,setLabel] = useState(address?.label ?? "住家");
    const [text,setText] = useState(address?.address_text ?? "");
    const [map,setMap] = useState(address?.map_url ?? "");
    const [defaultAddress,setDefaultAddress] = useState(address?.is_default ?? false);
    const [saving,setSaving] = useState(false);
    const [error,setError] = useState("");
    const [saved,setSaved] = useState<CustomerAddress | null>(null);

    async function save() {
        if (saving) return;
        const invalid = validateAddressForm(label,text,map);
        if (invalid) { setError(invalid); return; }
        setSaving(true); setError("");
        let wrote = saved !== null;
        try {
            // If only refresh failed, retry refresh rather than creating another address.
            const input = { label:label.trim(),address_text:text.trim() || null,map_url:map.trim() || null,is_default:defaultAddress };
            const value = saved ?? (address ? await updateCustomerAddress(customerId,address.address_id,input) : await createCustomerAddress(customerId,input));
            setSaved(value);
            wrote = true;
            await onSaved(value);
        } catch {
            setError(wrote ? "地址已保存，但列表刷新失败，请重试。" : "保存地址失败，请检查资料后重试。");
        } finally { setSaving(false); }
    }

    return <fieldset className="form-card inline-create" disabled={saving}>
        <legend>{address ? "编辑地址" : "新增地址"}</legend>
        <label>标签<input disabled={saved !== null} value={label} onChange={event => setLabel(event.target.value)} maxLength={100} required /></label>
        <label>文字地址（选填）<textarea disabled={saved !== null} rows={2} value={text} onChange={event => setText(event.target.value)} maxLength={4000} /></label>
        <label>地图链接（选填）<input disabled={saved !== null} type="url" value={map} onChange={event => setMap(event.target.value)} maxLength={2048} placeholder="https://..." /></label>
        <p className="form-hint">文字地址或地图链接至少填写一项。</p>
        {address?.latitude != null && address.longitude != null && <p className="form-hint">已有坐标会保留，无需重新填写。</p>}
        <label className="check-label"><input disabled={saved !== null} type="checkbox" checked={defaultAddress} onChange={event => setDefaultAddress(event.target.checked)} /> 默认地址</label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="v2-actions">
            {/* Buttons stay enabled after a successful write so refresh can be retried. */}
            <button type="button" className="text-button" disabled={saving} onClick={save}>{saving ? "保存中..." : saved ? "重试刷新" : "保存地址"}</button>
            <button type="button" className="text-button" disabled={saving} onClick={onCancel}>取消</button>
        </div>
    </fieldset>;
}

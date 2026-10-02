import { useState } from "react";
import { createPet, updatePet } from "../../services/petService";
import type { Pet } from "../../types/pet";
import BottomSheet from "./BottomSheet";

interface Props {
    customerId: string;
    pet?: Pick<Pet, "pet_id" | "pet_name" | "pet_type" | "pet_remark">;
    onClose: () => void;
    onSaved: () => Promise<void>;
}

export default function PetFormSheet({ customerId, pet, onClose, onSaved }: Props) {
    const [name, setName] = useState(pet?.pet_name ?? "");
    const [type, setType] = useState(pet?.pet_type ?? "");
    const [remark, setRemark] = useState(pet?.pet_remark ?? "");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    async function save() {
        if (!name.trim()) { setError("请填写宠物名称。"); return; }
        setSaving(true); setError("");
        try {
            if (pet) await updatePet(customerId, pet.pet_id, name.trim(), type.trim(), remark.trim());
            else await createPet(customerId, name.trim(), type.trim(), remark.trim());
            await onSaved();
        } catch (failure) {
            console.error(failure);
            setError("宠物保存失败，请检查资料后重试。");
        } finally { setSaving(false); }
    }

    return <BottomSheet title={pet ? "编辑宠物" : "新增宠物"} subtitle={pet?.pet_name} onClose={onClose}>
        <div className="sheet-form"><div className="form-card">
            <label>宠物名称<input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required /></label>
            <label>宠物类型<input value={type} onChange={(event) => setType(event.target.value)} maxLength={50} /></label>
            <label>备注<textarea rows={3} value={remark} onChange={(event) => setRemark(event.target.value)} /></label>
        </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary-button" type="button" disabled={saving} onClick={save}>{saving ? "保存中..." : "保存宠物"}</button>
            <button className="secondary-button" type="button" disabled={saving} onClick={onClose}>返回客户资料</button>
        </div>
    </BottomSheet>;
}

import { useState, type FormEvent } from "react";
import BottomSheet from "../sheets/BottomSheet";
import { completeAppointment } from "../../services/appointmentService";
import type { Appointment } from "../../types/appointment";
import { formatMoney } from "../../utils/appointmentFormat";
import { completionInitialAmount, parseMoneyInput, previewTotal, quoteLabel } from "../../utils/businessV2";

interface Props {
    appointment: Appointment;
    onClose: () => void;
    onSuccess: () => Promise<void>;
}

function CompleteAppointmentForm({ appointment, onClose, onSuccess }: Props) {
    const [entries, setEntries] = useState(() => appointment.pets.map((pet) => ({
        appointment_pet_id: pet.appointment_pet_id,
        amount: completionInitialAmount(pet),
        remark: pet.remark ?? "",
    })));
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    function updateEntry(index: number, field: "amount" | "remark", value: string) {
        setEntries((current) => current.map((entry, entryIndex) =>
            entryIndex === index ? { ...entry, [field]: value } : entry,
        ));
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (submitting) return;
        const invalid = entries.some((entry) => parseMoneyInput(entry.amount) === null);
        if (invalid) {
            setError("请为每只宠物填写非负金额，最多两位小数且不超过 RM99,999,999.99。");
            return;
        }
        setSubmitting(true);
        setError("");
        try {
            await completeAppointment(appointment.appointment_id, {
                pets: entries.map((entry) => ({
                    appointment_pet_id: entry.appointment_pet_id,
                    amount: Number(entry.amount),
                    remark: entry.remark.trim() || null,
                })),
            });
            await onSuccess();
        } catch (submitError) {
            console.error(submitError);
            setError("无法完成此预约，请重试。");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <BottomSheet title="完成服务" subtitle={appointment.customer_name} onClose={onClose}>
            <form className="sheet-form" onSubmit={submit}>
                {entries.map((entry, index) => {
                    const pet = appointment.pets[index];
                    return (
                        <fieldset className="form-card" key={entry.appointment_pet_id} disabled={submitting}>
                            <legend>{pet.pet_name} · {pet.service_name}</legend>
                            <p className="form-hint">预计服务费：{quoteLabel(pet.quoted_amount)}</p>
                            {pet.quoted_amount == null && pet.default_price != null && <p className="form-hint">输入建议来自当前默认价格 {formatMoney(pet.default_price)}，并非原预约预计费用。</p>}
                            {(pet.addons ?? []).map(addon => <p className="compact-line" key={addon.appointment_pet_addon_id}>加购：{addon.service_name_snapshot} · {formatMoney(addon.price_snapshot)}</p>)}
                            <label>宠物最终服务费（RM，已包含加购）
                                <input type="number" min="0" max="99999999.99" step="0.01" inputMode="decimal" required value={entry.amount}
                                    onChange={(event) => updateEntry(index, "amount", event.target.value)} />
                            </label>
                            <label>备注
                                <textarea rows={2} value={entry.remark} onChange={(event) => updateEntry(index, "remark", event.target.value)} />
                            </label>
                        </fieldset>
                    );
                })}
                <section className="form-card"><h3>上门交通费</h3>
                    <p className="v2-price-line"><span>{appointment.travel_fee_label ?? "原交通费"}</span><strong>{appointment.travel_fee_amount == null ? "未记录" : formatMoney(appointment.travel_fee_amount)}</strong></p>
                    <p className="form-hint">交通费单独计入预约总额，不计入任何宠物最终服务费。</p>
                    <p className="v2-quote" aria-live="polite">最终应收总额：{quoteLabel(previewTotal(entries.map(entry => parseMoneyInput(entry.amount)),appointment.travel_fee_amount ?? 0))}</p>
                </section>
                {error && <p className="form-error" role="alert">{error}</p>}
                <button className="primary-button" type="submit" disabled={submitting}>
                    {submitting ? "完成处理中..." : "保存并完成"}
                </button>
                <button className="secondary-button" type="button" onClick={onClose} disabled={submitting}>返回预约详情</button>
            </form>
        </BottomSheet>
    );
}

export default CompleteAppointmentForm;

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { Appointment } from "../../types/appointment";
import type { CustomerAddress } from "../../types/address";
import type { TravelFeeOption } from "../../types/travelFee";
import { getCustomerAddresses } from "../../services/addressService";
import { getTravelFeeOptions } from "../../services/travelFeeService";
import { appointmentLocation, initialExtras, travelPreview, type BookingExtrasDraft } from "../../utils/businessV2";
import { formatMoney } from "../../utils/appointmentFormat";
import AddressForm from "../addresses/AddressForm";
import LocationDisplay from "../addresses/LocationDisplay";

interface Props { customerId: string; draft: BookingExtrasDraft; onChange: Dispatch<SetStateAction<BookingExtrasDraft>>; appointment?: Appointment }

export default function AppointmentExtrasFields({ customerId,draft,onChange,appointment }: Props) {
    const [addresses,setAddresses] = useState<CustomerAddress[]>([]);
    const [options,setOptions] = useState<TravelFeeOption[]>([]);
    const [addressError,setAddressError] = useState("");
    const [optionError,setOptionError] = useState("");
    const [adding,setAdding] = useState(false);
    const editing = !!appointment;

    useEffect(() => {
        let current = true;
        getCustomerAddresses(customerId).then(data => {
            if (!current) return;
            setAddresses(data);
            onChange(value => ({ ...value,addressReady:true,addressId:!editing && !value.addressChanged
                ? String(data.find(address => address.is_active && address.is_default)?.address_id ?? "") : value.addressId }));
        }).catch(() => { if (current) setAddressError("地址加载失败，请重试。"); });
        return () => { current = false; };
    },[customerId,editing,onChange]);
    useEffect(() => {
        let current = true;
        getTravelFeeOptions().then(data => {
            if (current) { setOptions(data.filter(option => option.is_active)); onChange(value => ({ ...value,travelReady:true })); }
        }).catch(() => { if (current) setOptionError("交通费选项加载失败，请重试。"); });
        return () => { current = false; };
    },[onChange]);

    async function retryAddresses() {
        setAddressError("");
        try {
            const data = await getCustomerAddresses(customerId); setAddresses(data);
            onChange(value => ({ ...value,addressReady:true,addressId:!editing && !value.addressChanged
                ? String(data.find(address => address.is_active && address.is_default)?.address_id ?? "") : value.addressId }));
        } catch { setAddressError("地址加载失败，请重试。"); }
    }
    async function retryOptions() {
        setOptionError("");
        try { setOptions((await getTravelFeeOptions()).filter(option => option.is_active)); onChange(value => ({ ...value,travelReady:true })); }
        catch { setOptionError("交通费选项加载失败，请重试。"); }
    }

    function selectOption(id: string) {
        if (id === "keep" && appointment && appointment.travel_fee_amount != null && appointment.travel_fee_label != null) {
            const original = initialExtras(appointment);
            onChange(value => ({ ...value,optionId:original.optionId,travelLabel:original.travelLabel,travelChanged:false,manual:false,presetAmount:original.presetAmount,manualAmount:"" }));
            return;
        }
        const option = options.find(item => String(item.travel_fee_option_id) === id);
        onChange(value => ({ ...value,optionId:id,travelLabel:option?.label ?? null,travelChanged:true,manual:!!option && option.amount === null,
            presetAmount:option?.amount ?? null,manualAmount:"" }));
    }

    const originalAddress = appointment?.customer_address_id;
    const preservingAddress = !!appointment && draft.addressId === (originalAddress ?? "");
    const location = preservingAddress ? appointmentLocation(appointment) : addresses.find(address => String(address.address_id) === draft.addressId);
    const activeAddresses = addresses.filter(address => address.is_active && (!appointment || String(address.address_id) !== originalAddress));
    const travel = travelPreview(draft,appointment);
    const recordedTravel = !!appointment && appointment.travel_fee_label != null && appointment.travel_fee_amount != null;

    return <>
        <section className="form-card v2-booking-section v2-section-address" aria-label="预约服务地址">
            <div className="form-card-heading v2-section-heading"><h3>服务地址</h3><button className="text-button" type="button" disabled={!draft.addressReady} onClick={() => setAdding(value => !value)}>{adding ? "取消新增" : "+ 新增地址"}</button></div>
            {addressError ? <div><p className="form-error" role="alert">{addressError}</p><button className="text-button" type="button" onClick={retryAddresses}>重试地址</button></div> :
                !draft.addressReady ? <p className="form-hint">地址加载中...</p> : <>
                    <label>选择服务地址<select value={draft.addressId} onChange={event => onChange(value => ({ ...value,addressId:event.target.value,addressChanged:true }))}>
                        <option value="">不选择地址</option>
                        {originalAddress && <option value={originalAddress}>{appointment.address_label_snapshot ?? "原预约地址"}（保留原预约快照）</option>}
                        {activeAddresses.map(address => <option key={address.address_id} value={address.address_id}>{address.label}{address.is_default ? "（默认地址）" : ""}</option>)}
                    </select></label>
                    {draft.addressId && location ? <LocationDisplay location={location} /> : <p className="form-hint">{activeAddresses.length || originalAddress ? "此预约不选择服务地址。" : "未设置地址，仍可创建预约。"}</p>}
                    {preservingAddress && originalAddress && <p className="form-hint">保留预约时的地址，客户后来修改地址不会影响此快照。</p>}
                </>}
            {adding && <AddressForm customerId={customerId} onCancel={() => setAdding(false)} onSaved={async address => {
                const data = await getCustomerAddresses(customerId); setAddresses(data);
                onChange(value => ({ ...value,addressId:String(address.address_id),addressChanged:true,addressReady:true }));
                setAdding(false);
            }} />}
        </section>
        <section className="form-card v2-booking-section v2-section-travel" aria-label="预约上门交通费">
            <div className="v2-section-heading"><h3>上门交通费 *</h3></div>
            {optionError ? <div><p className="form-error" role="alert">{optionError}</p><button className="text-button" type="button" onClick={retryOptions}>重试交通费选项</button></div> :
                !draft.travelReady ? <p className="form-hint">交通费选项加载中...</p> : <label>交通费选项<select required aria-required="true" value={recordedTravel && !draft.travelChanged ? "keep" : draft.optionId} onChange={event => selectOption(event.target.value)}>
                    {recordedTravel && appointment && <option value="keep">保留原交通费 · {appointment.travel_fee_label ?? "未选择"}{appointment.travel_fee_amount == null ? "" : " · " + formatMoney(appointment.travel_fee_amount)}</option>}
                    <option value="" disabled>请选择交通费</option>
                    {options.map(option => <option key={option.travel_fee_option_id} value={option.travel_fee_option_id}>{option.label} · {option.amount === null ? "手动输入" : formatMoney(option.amount)}</option>)}
                </select></label>}
            {draft.travelReady && options.length === 0 && !recordedTravel && <p className="form-hint">暂无启用的交通费选项，请在更多 → 上门交通费管理中设置。</p>}
            {appointment && !recordedTravel && <p className="form-hint">原预约交通费未记录，请明确选择。</p>}
            {draft.travelChanged && draft.manual && <label>交通费金额（RM）<input type="number" min="0" max="99999999.99" step="0.01" inputMode="decimal" value={draft.manualAmount}
                onChange={event => onChange(value => ({ ...value,manualAmount:event.target.value }))} required /></label>}
            <p className="v2-price-line"><span>上门交通费</span><strong>{travel === null ? draft.manual ? "待填写" : "未选择" : formatMoney(travel)}</strong></p>
            <label>交通费备注（选填）<textarea rows={2} maxLength={2000} value={draft.note} onChange={event => onChange(value => ({ ...value,note:event.target.value }))} /></label>
        </section>
    </>;
}

import { useEffect, useState } from "react";
import BottomSheet from "../sheets/BottomSheet";
import { editAppointment } from "../../services/appointmentService";
import { getCustomerPets } from "../../services/petService";
import { getServices } from "../../services/serviceService";
import type { Appointment } from "../../types/appointment";
import type { Pet } from "../../types/pet";
import type { Service } from "../../types/service";
import { bookingExtrasPayload, bookingPetPayload, changePetDraft, emptyPetDraft, initialExtras, travelEstimate, type BookingPetDraft } from "../../utils/businessV2";
import PetServicesFields from "./PetServicesFields";
import AppointmentExtrasFields from "./AppointmentExtrasFields";
import { useBookingValidation } from "./useBookingValidation";
import { FieldValidation,ValidationSummary } from "./BookingValidation";
import BookingEstimate from "./BookingEstimate";

interface Props { appointment: Appointment; onClose: () => void; onSuccess: (date: string) => Promise<void> }

export default function EditAppointmentSheet({ appointment, onClose, onSuccess }: Props) {
    const [date, setDate] = useState(appointment.appointment_date);
    const [time, setTime] = useState(appointment.start_time.slice(0, 5));
    const [remark, setRemark] = useState(appointment.remark ?? "");
    const [rows, setRows] = useState<BookingPetDraft[]>(appointment.pets.map((pet, index) => ({
        key: index + 1, appointment_pet_id: pet.appointment_pet_id, pet_id: String(pet.pet_id),
        service_id: String(pet.service_id), remark: pet.remark ?? "",
        addonIds:(pet.addons ?? []).map(addon => String(addon.service_id)),
    })));
    const [extras,setExtras] = useState(() => initialExtras(appointment));
    const [pets, setPets] = useState<Pet[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    const validation = useBookingValidation({customerId:appointment.customer_id,date,time,rows,pets,services,extras,appointment});

    useEffect(() => {
        let current = true;
        Promise.all([getCustomerPets(appointment.customer_id,true), getServices(true)])
            .then(([petData, serviceData]) => { if (current) { setPets(petData); setServices(serviceData); } })
            .catch(() => { if (current) setError("宠物或服务加载失败，请重新打开表单。"); })
            .finally(() => { if (current) setLoading(false); });
        return () => { current = false; };
    }, [appointment.customer_id]);

    function changeRow(key: number, field: "pet_id" | "service_id" | "remark", value: string) {
        setRows((current) => current.map((row) => row.key === key ? changePetDraft(row,field,value) : row));
    }

    async function save() {
        if (submitting) return;
        if (!validation.validate()) return;
        setSubmitting(true); setError("");
        try {
            await editAppointment(appointment.appointment_id, {
                appointment_date: date, start_time: time, remark: remark.trim() || null,
                ...bookingExtrasPayload(extras,appointment),
                pets: rows.map(bookingPetPayload),
            });
            await onSuccess(date);
        } catch (failure) {
            console.error(failure);
            if(!validation.report(failure)) setError("预约保存失败，请检查资料后重试。");
        } finally { setSubmitting(false); }
    }

    return <BottomSheet title="编辑预约" subtitle={appointment.customer_name} onClose={onClose}>
        {loading ? <p className="form-hint">表单加载中...</p> : <div className="sheet-form">
            <div className="form-card appointment-time-fields">
                <label tabIndex={-1} data-validation-field="date">日期<input aria-label="日期" aria-invalid={validation.issues.some(i=>i.field==="date")} aria-describedby="validation-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required /><FieldValidation field="date" issues={validation.issues} /></label>
                <label tabIndex={-1} data-validation-field="time">时间<input aria-label="时间" aria-invalid={validation.issues.some(i=>i.field==="time")} aria-describedby="validation-time" type="time" value={time} onChange={(event) => setTime(event.target.value)} required /><FieldValidation field="time" issues={validation.issues} /></label>
                <p className="form-hint">客户： {appointment.customer_name}</p>
            </div>
            <section className="form-card v2-booking-section v2-section-pets v2-pet-section" aria-label="宠物与服务" tabIndex={-1} data-validation-field="pets">
            <div className="v2-section-heading"><h3>宠物与服务</h3></div><FieldValidation field="pets" issues={validation.issues} />
            {rows.map((row, index) => <div className="form-card v2-pet-card" key={row.key}>
                <div className="form-card-heading"><h4>宠物 {index + 1}{row.pet_id ? ` · ${pets.find(pet => String(pet.pet_id) === row.pet_id)?.pet_name ?? ""}` : ""}</h4>
                    {rows.length > 1 && <button type="button" className="text-button" onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}>移除</button>}
                </div>
                <label tabIndex={-1} data-validation-field={`pet-${row.key}`}>宠物<select aria-label="宠物" aria-invalid={validation.issues.some(i=>i.field===`pet-${row.key}`)} aria-describedby={`validation-pet-${row.key}`} value={row.pet_id} onChange={(event) => changeRow(row.key, "pet_id", event.target.value)} required>
                    <option value="">请选择宠物</option>{pets.filter(pet=>!pet.is_archived || appointment.pets.some(original=>original.appointment_pet_id===row.appointment_pet_id && String(original.pet_id)===String(pet.pet_id))).map((pet) => <option key={pet.pet_id} value={pet.pet_id}>{pet.pet_name}</option>)}
                </select></label>
                <FieldValidation field={`pet-${row.key}`} issues={validation.issues} />
                <PetServicesFields row={row} pets={pets} services={services} issues={validation.issues} original={appointment.pets.find(pet => pet.appointment_pet_id === row.appointment_pet_id)}
                    onBase={id => changeRow(row.key,"service_id",id)}
                    onAddons={addonIds => setRows(current => current.map(item => item.key === row.key ? { ...item,addonIds } : item))} />
                <label>宠物备注<textarea rows={2} value={row.remark} onChange={(event) => changeRow(row.key, "remark", event.target.value)} /></label>
            </div>)}
            <button className="text-button" type="button" onClick={() => setRows((current) => [...current,emptyPetDraft(Math.max(0,...current.map(row => row.key)) + 1)])}>+ 添加另一只宠物</button>
            </section>
            <AppointmentExtrasFields customerId={appointment.customer_id} draft={extras} onChange={setExtras} issues={validation.issues} appointment={appointment} />
            <div className="form-card v2-booking-section"><div className="v2-section-heading"><h3>其他信息</h3></div><label>预约备注<textarea rows={2} value={remark} onChange={(event) => setRemark(event.target.value)} /></label></div>
            <BookingEstimate rows={rows} pets={pets} services={services} travel={travelEstimate(extras,appointment)} travelSelected={extras.travelLabel !== null} editing />
            <ValidationSummary issues={validation.issues} />
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary-button" type="button" onClick={save} disabled={submitting}>{submitting ? "保存中..." : "保存修改"}</button>
            <button className="secondary-button" type="button" onClick={onClose} disabled={submitting}>返回</button>
        </div>}
    </BottomSheet>;
}

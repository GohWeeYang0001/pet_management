import { useEffect, useState } from "react";
import BottomSheet from "./BottomSheet";
import { createAppointment } from "../../services/appointmentService";
import { createCustomer, getCustomers } from "../../services/customerService";
import { createPet, getCustomerPets } from "../../services/petService";
import { getServices } from "../../services/serviceService";
import type { Customer } from "../../types/customer";
import type { Pet } from "../../types/pet";
import type { Service } from "../../types/service";
import { displayPetType } from "../../utils/displayLabels";
import { formatAppointmentDate } from "../../utils/appointmentFormat";
import { bookingExtrasPayload, bookingPetPayload, changePetDraft, emptyPetDraft, initialExtras, travelEstimate, type BookingPetDraft } from "../../utils/businessV2";
import PetServicesFields from "../appointments/PetServicesFields";
import AppointmentExtrasFields from "../appointments/AppointmentExtrasFields";
import { useBookingValidation } from "../appointments/useBookingValidation";
import { FieldValidation,ValidationSummary } from "../appointments/BookingValidation";
import BookingEstimate from "../appointments/BookingEstimate";

interface Props {
    date: string;
    onClose: () => void;
    onSuccess: () => Promise<void>;
}

function NewAppointmentSheet({ date, onClose, onSuccess }: Props) {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [pets, setPets] = useState<Pet[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [customerId, setCustomerId] = useState("");
    const [customerSearch, setCustomerSearch] = useState("");
    const [petRows, setPetRows] = useState<BookingPetDraft[]>([emptyPetDraft(1)]);
    const [extras,setExtras] = useState(() => initialExtras());
    const [nextRowKey, setNextRowKey] = useState(2);
    const [time, setTime] = useState("");
    const [remark, setRemark] = useState("");
    const [showCustomerForm, setShowCustomerForm] = useState(false);
    const [customerName, setCustomerName] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [showPetForm, setShowPetForm] = useState(false);
    const [petName, setPetName] = useState("");
    const [petType, setPetType] = useState("");
    const [petRemark, setPetRemark] = useState("");
    const [loading, setLoading] = useState(true);
    const [loadingPets, setLoadingPets] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [customerError, setCustomerError] = useState("");
    const [petError, setPetError] = useState("");

    const validation = useBookingValidation({customerId,date,time,rows:petRows,pets,services,extras});

    useEffect(() => {
        let current = true;
        Promise.all([getCustomers(), getServices()])
            .then(([customerData, serviceData]) => {
                if (current) {
                    setCustomers(customerData);
                    setServices(serviceData);
                }
            })
            .catch((loadError) => {
                console.error(loadError);
                if (current) setError("客户或服务加载失败，请关闭后重试。");
            })
            .finally(() => { if (current) setLoading(false); });
        return () => { current = false; };
    }, []);

    useEffect(() => {
        if (!customerId) {
            return;
        }
        let current = true;
        getCustomerPets(customerId)
            .then((data) => { if (current) setPets(data); })
            .catch((loadError) => {
                console.error(loadError);
                if (current) setError("此客户的宠物加载失败，请尝试选择其他客户。");
            })
            .finally(() => { if (current) setLoadingPets(false); });
        return () => { current = false; };
    }, [customerId]);

    function selectCustomer(id: string) {
        setCustomerId(id);
        setPets([]);
        setPetRows([emptyPetDraft(1)]);
        setExtras(initialExtras());
        setNextRowKey(2);
        setLoadingPets(Boolean(id));
        setError("");
        setShowPetForm(false);
    }

    function updateRow(key: number, field: "pet_id" | "service_id" | "remark", value: string) {
        setPetRows((rows) => rows.map((row) => row.key === key ? changePetDraft(row,field,value) : row));
    }

    async function submitCustomer() {
        if (!customerName.trim() || !customerPhone.trim()) {
            setCustomerError("请填写姓名和电话号码。");
            return;
        }
        setSubmitting(true);
        setCustomerError("");
        try {
            const customer = await createCustomer(customerName.trim(), customerPhone.trim());
            setCustomers((current) => [...current, customer]);
            setCustomerSearch("");
            selectCustomer(String(customer.customer_id));
            setShowCustomerForm(false);
            setCustomerName("");
            setCustomerPhone("");
        } catch (submitError) {
            console.error(submitError);
            setCustomerError("客户新增失败，请检查资料后重试。");
        } finally {
            setSubmitting(false);
        }
    }

    async function submitPet() {
        if (!customerId || !petName.trim()) {
            setPetError("请填写宠物名称。");
            return;
        }
        setSubmitting(true);
        setPetError("");
        try {
            const pet = await createPet(customerId, petName.trim(), petType.trim(), petRemark.trim());
            setPets((current) => [...current, pet]);
            setPetRows((rows) => {
                const emptyIndex = rows.findIndex((row) => !row.pet_id);
                if (emptyIndex >= 0) {
                    return rows.map((row, index) => index === emptyIndex ? changePetDraft(row,"pet_id",String(pet.pet_id)) : row);
                }
                return [...rows, { ...emptyPetDraft(nextRowKey), pet_id: String(pet.pet_id) }];
            });
            if (petRows.every((row) => row.pet_id)) setNextRowKey((key) => key + 1);
            setShowPetForm(false);
            setPetName("");
            setPetType("");
            setPetRemark("");
        } catch (submitError) {
            console.error(submitError);
            setPetError("宠物新增失败，请重试。");
        } finally {
            setSubmitting(false);
        }
    }

    async function submitAppointment() {
        if (submitting) return;
        if (!validation.validate()) return;
        setSubmitting(true);
        setError("");
        try {
            await createAppointment({
                customer_id: customerId,
                appointment_date: date,
                start_time: time,
                remark: remark.trim() || null,
                ...bookingExtrasPayload(extras),
                pets: petRows.map(bookingPetPayload),
            });
            await onSuccess();
        } catch (submitError) {
            console.error(submitError);
            if(!validation.report(submitError)) setError("预约新增失败，请检查资料后重试。");
        } finally {
            setSubmitting(false);
        }
    }

    const visibleCustomers = customers.filter((customer) =>
        `${customer.customer_name} ${customer.customer_hp}`.toLowerCase().includes(customerSearch.toLowerCase()),
    );
    const selectedCustomer = customers.find((customer) => String(customer.customer_id) === customerId);

    return (
        <BottomSheet title="新增预约" subtitle={formatAppointmentDate(date)} onClose={onClose}>
            {loading ? <p className="form-hint">表单加载中...</p> : (
                <div className="sheet-form">
                    <div className="appointment-fields">
                        <div className="form-card appointment-time-fields">
                            <label tabIndex={-1} data-validation-field="date">日期<input aria-label="日期" aria-invalid={validation.issues.some(i=>i.field==="date")} aria-describedby="validation-date" type="text" value={formatAppointmentDate(date)} readOnly /><FieldValidation field="date" issues={validation.issues} /></label>
                            <label tabIndex={-1} data-validation-field="time">时间<input aria-label="时间" aria-invalid={validation.issues.some(i=>i.field==="time")} aria-describedby="validation-time" type="time" value={time} onChange={(event) => setTime(event.target.value)} required /><FieldValidation field="time" issues={validation.issues} /></label>
                        </div>

                        <section className="form-card v2-booking-section v2-section-customer" aria-label="预约客户" tabIndex={-1} data-validation-field="customer">
                            <div className="v2-section-heading"><h3>客户</h3></div>
                            <label>按姓名或电话号码搜索
                                <input type="search" value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="搜索客户" />
                            </label>
                            <label>选择客户
                                <select aria-label="选择客户" aria-invalid={validation.issues.some(i=>i.field==="customer")} aria-describedby="validation-customer" value={customerId} onChange={(event) => selectCustomer(event.target.value)} required>
                                    <option value="">请选择客户</option>
                                    {selectedCustomer && !visibleCustomers.some((customer) => String(customer.customer_id) === customerId) && (
                                        <option value={customerId}>{selectedCustomer.customer_name} · {selectedCustomer.customer_hp}</option>
                                    )}
                                    {visibleCustomers.map((customer) => (
                                        <option key={customer.customer_id} value={customer.customer_id}>
                                            {customer.customer_name} · {customer.customer_hp}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <FieldValidation field="customer" issues={validation.issues} />
                            <button className="text-button" type="button" onClick={() => setShowCustomerForm((value) => !value)}>
                                {showCustomerForm ? "取消新增客户" : "+ 新增客户"}
                            </button>
                        </section>

                        {showCustomerForm && (
                            <div className="form-card inline-create">
                                <h3>新增客户</h3>
                                <label>客户姓名<input value={customerName} onChange={(event) => setCustomerName(event.target.value)} maxLength={100} /></label>
                                <label>电话号码<input type="tel" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} maxLength={20} /></label>
                                {customerError && <p className="form-error" role="alert">{customerError}</p>}
                                <button className="secondary-button" type="button" onClick={submitCustomer} disabled={submitting}>{submitting ? "保存中..." : "保存客户"}</button>
                            </div>
                        )}

                        {customerId && (
                            <section className="form-card v2-booking-section v2-section-pets v2-pet-section" aria-label="宠物与服务" tabIndex={-1} data-validation-field="pets">
                                <div className="v2-section-heading"><h3>宠物与服务</h3></div><FieldValidation field="pets" issues={validation.issues} />
                                {loadingPets && <p className="form-hint">宠物加载中...</p>}
                                {!loadingPets && pets.length === 0 && <p className="form-hint">暂无宠物，请先为此客户添加宠物。</p>}
                                {petRows.map((row, index) => (
                                    <div className="form-card v2-pet-card" key={row.key}>
                                        <div className="form-card-heading">
                                            <h4>宠物 {index + 1}{row.pet_id ? ` · ${pets.find(pet => String(pet.pet_id) === row.pet_id)?.pet_name ?? ""}` : ""}</h4>
                                            {index > 0 && <button className="text-button" type="button" onClick={() => setPetRows((rows) => rows.filter((item) => item.key !== row.key))}>移除</button>}
                                        </div>
                                        <label tabIndex={-1} data-validation-field={`pet-${row.key}`}>宠物
                                            <select aria-label="宠物" aria-invalid={validation.issues.some(i=>i.field===`pet-${row.key}`)} aria-describedby={`validation-pet-${row.key}`} value={row.pet_id} onChange={(event) => updateRow(row.key, "pet_id", event.target.value)} required>
                                                <option value="">请选择宠物</option>
                                                {pets.map((pet) => <option key={pet.pet_id} value={pet.pet_id}>{pet.pet_name}{pet.pet_type ? ` · 品种：${displayPetType(pet.pet_type)}` : ""}</option>)}
                                            </select>
                                        </label>
                                        <FieldValidation field={`pet-${row.key}`} issues={validation.issues} />
                                        <PetServicesFields row={row} pets={pets} services={services} issues={validation.issues}
                                            onBase={id => updateRow(row.key,"service_id",id)}
                                            onAddons={addonIds => setPetRows(current => current.map(item => item.key === row.key ? { ...item,addonIds } : item))} />
                                        <label>宠物备注
                                            <textarea rows={2} value={row.remark} onChange={(event) => updateRow(row.key, "remark", event.target.value)} />
                                        </label>
                                    </div>
                                ))}
                                <button className="text-button" type="button" onClick={() => {
                                    setPetRows((rows) => [...rows, emptyPetDraft(nextRowKey)]);
                                    setNextRowKey((key) => key + 1);
                                }}>+ 添加另一只宠物</button>
                                <button className="text-button" type="button" onClick={() => setShowPetForm((value) => !value)}>
                                    {showPetForm ? "取消新增宠物" : "+ 添加宠物"}
                                </button>
                                {showPetForm && (
                                    <div className="form-card inline-create">
                                        <h3>新增宠物</h3>
                                        <label>宠物名称<input value={petName} onChange={(event) => setPetName(event.target.value)} maxLength={100} /></label>
                                        <label>品种（选填）<input value={petType} onChange={(event) => setPetType(event.target.value)} maxLength={50} /></label>
                                        <label>备注<textarea rows={2} value={petRemark} onChange={(event) => setPetRemark(event.target.value)} /></label>
                                        {petError && <p className="form-error" role="alert">{petError}</p>}
                                        <button className="secondary-button" type="button" onClick={submitPet} disabled={submitting}>{submitting ? "保存中..." : "保存宠物"}</button>
                                    </div>
                                )}
                            </section>
                        )}
                        <div className="form-card v2-booking-section">
                            <div className="v2-section-heading"><h3>其他信息</h3></div>
                            <label>预约备注
                                <textarea rows={2} value={remark} onChange={(event) => setRemark(event.target.value)} placeholder="例如：通过 WhatsApp 预约" />
                            </label>
                        </div>
                    </div>
                    {customerId && <AppointmentExtrasFields key={customerId} customerId={customerId} draft={extras} onChange={setExtras} issues={validation.issues} />}
                    {customerId && <BookingEstimate rows={petRows} pets={pets} services={services} travel={travelEstimate(extras)} travelSelected={extras.travelLabel !== null} />}
                    {!services.some(service => service.service_kind === "BASE") && <p className="form-error">暂无已启用的基础服务。</p>}
                    <ValidationSummary issues={validation.issues} />
                    {error && <p className="form-error" role="alert">{error}</p>}
                    <button className="primary-button" type="button" onClick={submitAppointment} disabled={submitting || loadingPets}>
                        {submitting ? "创建中..." : "创建预约"}
                    </button>
                    <button className="secondary-button" type="button" onClick={onClose} disabled={submitting}>返回当日预约</button>
                </div>
            )}
        </BottomSheet>
    );
}

export default NewAppointmentSheet;

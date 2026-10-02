import { useEffect, useState } from "react";
import BottomSheet from "./BottomSheet";
import { createAppointment } from "../../services/appointmentService";
import { createCustomer, getCustomers } from "../../services/customerService";
import { createPet, getCustomerPets } from "../../services/petService";
import { getServices } from "../../services/serviceService";
import type { Customer } from "../../types/customer";
import type { Pet } from "../../types/pet";
import type { Service } from "../../types/service";
import { formatAppointmentDate, formatMoney } from "../../utils/appointmentFormat";

interface Props {
    date: string;
    onClose: () => void;
    onSuccess: () => Promise<void>;
}

interface PetRow {
    key: number;
    petId: string;
    serviceId: string;
    remark: string;
}

function emptyRow(key: number): PetRow {
    return { key, petId: "", serviceId: "", remark: "" };
}

function NewAppointmentSheet({ date, onClose, onSuccess }: Props) {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [pets, setPets] = useState<Pet[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [customerId, setCustomerId] = useState("");
    const [customerSearch, setCustomerSearch] = useState("");
    const [petRows, setPetRows] = useState<PetRow[]>([emptyRow(1)]);
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
                if (current) setError("Could not load customers or services. Close and try again.");
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
                if (current) setError("Could not load this customer's pets. Please try another customer.");
            })
            .finally(() => { if (current) setLoadingPets(false); });
        return () => { current = false; };
    }, [customerId]);

    function selectCustomer(id: string) {
        setCustomerId(id);
        setPets([]);
        setPetRows([emptyRow(1)]);
        setNextRowKey(2);
        setLoadingPets(Boolean(id));
        setError("");
        setShowPetForm(false);
    }

    function updateRow(key: number, field: "petId" | "serviceId" | "remark", value: string) {
        setPetRows((rows) => rows.map((row) => row.key === key ? { ...row, [field]: value } : row));
    }

    async function submitCustomer() {
        if (!customerName.trim() || !customerPhone.trim()) {
            setCustomerError("Name and phone number are required.");
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
            setCustomerError("Could not create customer. Check the details and try again.");
        } finally {
            setSubmitting(false);
        }
    }

    async function submitPet() {
        if (!customerId || !petName.trim()) {
            setPetError("Pet name is required.");
            return;
        }
        setSubmitting(true);
        setPetError("");
        try {
            const pet = await createPet(customerId, petName.trim(), petType.trim(), petRemark.trim());
            setPets((current) => [...current, pet]);
            setPetRows((rows) => {
                const emptyIndex = rows.findIndex((row) => !row.petId);
                if (emptyIndex >= 0) {
                    return rows.map((row, index) => index === emptyIndex ? { ...row, petId: String(pet.pet_id) } : row);
                }
                return [...rows, { ...emptyRow(nextRowKey), petId: String(pet.pet_id) }];
            });
            if (petRows.every((row) => row.petId)) setNextRowKey((key) => key + 1);
            setShowPetForm(false);
            setPetName("");
            setPetType("");
            setPetRemark("");
        } catch (submitError) {
            console.error(submitError);
            setPetError("Could not create pet. Please try again.");
        } finally {
            setSubmitting(false);
        }
    }

    async function submitAppointment() {
        if (submitting) return;
        if (!customerId || !time || petRows.length === 0 || petRows.some((row) => !row.petId || !row.serviceId)) {
            setError("Choose a time, customer, pet and service for every row.");
            return;
        }
        setSubmitting(true);
        setError("");
        try {
            await createAppointment({
                customer_id: customerId,
                appointment_date: date,
                start_time: time,
                remark: remark.trim() || null,
                pets: petRows.map((row) => ({
                    pet_id: row.petId,
                    service_id: row.serviceId,
                    remark: row.remark.trim() || null,
                })),
            });
            await onSuccess();
        } catch (submitError) {
            console.error(submitError);
            setError("Could not create appointment. Please check the details and try again.");
        } finally {
            setSubmitting(false);
        }
    }

    const visibleCustomers = customers.filter((customer) =>
        `${customer.customer_name} ${customer.customer_hp}`.toLowerCase().includes(customerSearch.toLowerCase()),
    );
    const selectedCustomer = customers.find((customer) => String(customer.customer_id) === customerId);

    return (
        <BottomSheet title="New Appointment" subtitle={formatAppointmentDate(date)} onClose={onClose}>
            {loading ? <p className="form-hint">Loading form...</p> : (
                <div className="sheet-form">
                    <div className="appointment-fields">
                        <div className="form-card appointment-time-fields">
                            <label>Date<input type="text" value={formatAppointmentDate(date)} readOnly /></label>
                            <label>Time<input type="time" value={time} onChange={(event) => setTime(event.target.value)} required /></label>
                        </div>

                        <div className="form-card">
                            <h3>Customer</h3>
                            <label>Search by name or phone
                                <input type="search" value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Search customers" />
                            </label>
                            <label>Select customer
                                <select value={customerId} onChange={(event) => selectCustomer(event.target.value)} required>
                                    <option value="">Choose customer</option>
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
                            <button className="text-button" type="button" onClick={() => setShowCustomerForm((value) => !value)}>
                                {showCustomerForm ? "Cancel new customer" : "+ Add New Customer"}
                            </button>
                        </div>

                        {showCustomerForm && (
                            <div className="form-card inline-create">
                                <h3>New Customer</h3>
                                <label>Customer Name<input value={customerName} onChange={(event) => setCustomerName(event.target.value)} maxLength={100} /></label>
                                <label>Phone Number<input type="tel" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} maxLength={20} /></label>
                                {customerError && <p className="form-error" role="alert">{customerError}</p>}
                                <button className="secondary-button" type="button" onClick={submitCustomer} disabled={submitting}>{submitting ? "Saving..." : "Save Customer"}</button>
                            </div>
                        )}

                        {customerId && (
                            <>
                                {loadingPets && <p className="form-hint">Loading pets...</p>}
                                {!loadingPets && pets.length === 0 && <p className="form-hint">No pets yet. Add a pet for this customer.</p>}
                                {petRows.map((row, index) => (
                                    <div className="form-card" key={row.key}>
                                        <div className="form-card-heading">
                                            <h3>Pet {index + 1}</h3>
                                            {index > 0 && <button className="text-button" type="button" onClick={() => setPetRows((rows) => rows.filter((item) => item.key !== row.key))}>Remove</button>}
                                        </div>
                                        <label>Pet
                                            <select value={row.petId} onChange={(event) => updateRow(row.key, "petId", event.target.value)} required>
                                                <option value="">Choose pet</option>
                                                {pets.map((pet) => <option key={pet.pet_id} value={pet.pet_id}>{pet.pet_name}{pet.pet_type ? ` · ${pet.pet_type}` : ""}</option>)}
                                            </select>
                                        </label>
                                        <label>Service
                                            <select value={row.serviceId} onChange={(event) => updateRow(row.key, "serviceId", event.target.value)} required>
                                                <option value="">Choose service</option>
                                                {services.map((service) => <option key={service.service_id} value={service.service_id}>{service.service_name} · {formatMoney(service.default_price)}</option>)}
                                            </select>
                                        </label>
                                        <label>Pet remark
                                            <textarea rows={2} value={row.remark} onChange={(event) => updateRow(row.key, "remark", event.target.value)} />
                                        </label>
                                    </div>
                                ))}
                                <button className="text-button" type="button" onClick={() => {
                                    setPetRows((rows) => [...rows, emptyRow(nextRowKey)]);
                                    setNextRowKey((key) => key + 1);
                                }}>+ Add Another Pet</button>
                                <button className="text-button" type="button" onClick={() => setShowPetForm((value) => !value)}>
                                    {showPetForm ? "Cancel new pet" : "+ Add Pet"}
                                </button>
                                {showPetForm && (
                                    <div className="form-card inline-create">
                                        <h3>New Pet</h3>
                                        <label>Pet Name<input value={petName} onChange={(event) => setPetName(event.target.value)} maxLength={100} /></label>
                                        <label>Pet Type<input value={petType} onChange={(event) => setPetType(event.target.value)} maxLength={50} /></label>
                                        <label>Remark<textarea rows={2} value={petRemark} onChange={(event) => setPetRemark(event.target.value)} /></label>
                                        {petError && <p className="form-error" role="alert">{petError}</p>}
                                        <button className="secondary-button" type="button" onClick={submitPet} disabled={submitting}>{submitting ? "Saving..." : "Save Pet"}</button>
                                    </div>
                                )}
                            </>
                        )}
                        <div className="form-card">
                            <label>Appointment remark
                                <textarea rows={2} value={remark} onChange={(event) => setRemark(event.target.value)} placeholder="e.g. WhatsApp booking" />
                            </label>
                        </div>
                    </div>

                    {services.length === 0 && <p className="form-error">No active services are available.</p>}
                    {error && <p className="form-error" role="alert">{error}</p>}
                    <button className="primary-button" type="button" onClick={submitAppointment} disabled={submitting || services.length === 0 || loadingPets}>
                        {submitting ? "Creating..." : "Create Appointment"}
                    </button>
                    <button className="secondary-button" type="button" onClick={onClose} disabled={submitting}>Back to day</button>
                </div>
            )}
        </BottomSheet>
    );
}

export default NewAppointmentSheet;

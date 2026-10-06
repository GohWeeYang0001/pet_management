import type { Appointment, AppointmentExtrasInput, AppointmentPet } from "../types/appointment";
import type { LocationSnapshot } from "../types/address";
import type { Pet } from "../types/pet";
import type { Service, ServiceKind } from "../types/service";
import { formatMoney } from "./appointmentFormat";

export const MAX_MONEY = 99999999.99;

export function parseMoneyInput(text: string): number | null {
    if (!/^\d+(?:\.\d{1,2})?$/.test(text.trim())) return null;
    const value = Number(text);
    return Number.isFinite(value) && value >= 0 && value <= MAX_MONEY ? value : null;
}

function cents(value: number | null | undefined): number | null {
    return value != null && parseMoneyInput(String(value)) !== null ? Math.round(value * 100) : null;
}

export function previewPetQuote(base: number | null | undefined, addons: Array<number | null>): number | null {
    const parts = [base, ...addons].map(cents);
    if (parts.some(value => value === null)) return null;
    const total = parts.reduce<number>((sum, value) => sum + value!, 0);
    return total <= Math.round(MAX_MONEY * 100) ? total / 100 : null;
}

export function previewTotal(quotes: Array<number | null | undefined>, travel: number | null): number | null {
    if (!quotes.length || quotes.some(value => value == null) || travel === null) return null;
    const total = quotes.reduce<number>((sum, value) => sum + Math.round(value! * 100), Math.round(travel * 100));
    return Number.isSafeInteger(total) ? total / 100 : null;
}

export function quoteLabel(value: number | null | undefined): string {
    return value == null ? "未记录" : formatMoney(value);
}

export interface BookingPetDraft {
    key: number;
    appointment_pet_id?: number;
    pet_id: string;
    service_id: string;
    addonIds: string[];
    remark: string;
}

export function emptyPetDraft(key: number): BookingPetDraft {
    return { key, pet_id: "", service_id: "", addonIds: [], remark: "" };
}

export function eligibleServices(services: Service[], kind: ServiceKind, pet: Pet | undefined, original?: AppointmentPet): Service[] {
    const retained = original && pet && String(original.pet_id) === String(pet.pet_id)
        ? kind === "BASE" ? [String(original.service_id)] : (original.addons ?? []).map(addon => String(addon.service_id)) : [];
    return services.filter(service => service.service_kind === kind &&
        ((!!pet && service.is_active) || retained.includes(String(service.service_id))));
}

export function changePetDraft(row: BookingPetDraft, field: "pet_id" | "service_id" | "remark", value: string): BookingPetDraft {
    return field === "pet_id" && value !== row.pet_id
        ? { ...row, pet_id: value, service_id: "", addonIds: [] } : { ...row, [field]: value };
}

export function petDraftQuote(row: BookingPetDraft, services: Service[]): number | null {
    const base = services.find(service => String(service.service_id) === row.service_id);
    return previewPetQuote(base?.default_price, row.addonIds.map(id =>
        services.find(service => String(service.service_id) === id)?.default_price ?? null));
}

export function validatePetDrafts(rows: BookingPetDraft[], pets: Pet[], services: Service[], originals: AppointmentPet[] = []): string | null {
    if (!rows.length) return "请至少添加一只宠物。";
    for (const row of rows) {
        const pet = pets.find(p => String(p.pet_id) === row.pet_id);
        const original = originals.find(p => p.appointment_pet_id === row.appointment_pet_id);
        const base = eligibleServices(services,"BASE",pet,original).find(s => String(s.service_id) === row.service_id);
        if (!pet || !base) return "请为每只宠物选择适用的基础服务。";
        const available = eligibleServices(services,"ADDON",pet,original);
        if (new Set(row.addonIds).size !== row.addonIds.length || row.addonIds.some(id =>
            !available.some(s => String(s.service_id) === id && cents(s.default_price) !== null))) {
            return "请检查加购项目是否适用且已设置价格。";
        }
        if (base.default_price !== null && petDraftQuote(row,services) === null) return "预计费用无效或超过金额上限，请检查服务价格。";
    }
    return null;
}

export function bookingPetPayload(row: BookingPetDraft) {
    return { appointment_pet_id: row.appointment_pet_id, pet_id: row.pet_id, service_id: row.service_id,
        remark: row.remark.trim() || null, addons: row.addonIds.map(service_id => ({ service_id })) };
}

export interface BookingExtrasDraft {
    addressReady: boolean;
    travelReady: boolean;
    addressId: string;
    addressChanged: boolean;
    optionId: string;
    travelLabel: string | null;
    travelChanged: boolean;
    manual: boolean;
    presetAmount: number | null;
    manualAmount: string;
    note: string;
}

export function initialExtras(appointment?: Appointment): BookingExtrasDraft {
    return { addressReady:false,travelReady:false,addressId: appointment?.customer_address_id ?? "", addressChanged: false,
        optionId: "", travelLabel:appointment?.travel_fee_label ?? null, travelChanged: false, manual: false,
        presetAmount: appointment?.travel_fee_amount ?? null, manualAmount: "", note: appointment?.travel_fee_note ?? "" };
}

export function travelPreview(draft: BookingExtrasDraft, appointment?: Appointment): number | null {
    if (appointment && !draft.travelChanged) return appointment.travel_fee_amount ?? null;
    return draft.manual ? parseMoneyInput(draft.manualAmount) : draft.presetAmount;
}

// Required but unselected travel makes the booking estimate incomplete.
export function travelEstimate(draft: BookingExtrasDraft, appointment?: Appointment): number | null {
    const fee = travelPreview(draft,appointment);
    return fee;
}

export function validateTravelDraft(draft: BookingExtrasDraft, appointment?: Appointment): string | null {
    if (appointment && !draft.travelChanged && appointment.travel_fee_label != null && appointment.travel_fee_amount != null) return null;
    if (!draft.optionId || draft.travelLabel == null) return "请选择交通费。";
    const amount=travelPreview(draft,appointment);
    return amount == null || parseMoneyInput(String(amount)) == null ? "请填写有效的交通费金额，最多两位小数。" : null;
}

export function bookingExtrasPayload(draft: BookingExtrasDraft, appointment?: Appointment): AppointmentExtrasInput {
    const invalid = validateTravelDraft(draft,appointment);
    if (invalid) throw new Error(invalid);
    const input: AppointmentExtrasInput = {};
    if (!appointment || draft.addressId !== (appointment.customer_address_id ?? "")) input.customer_address_id = draft.addressId || null;
    if (!appointment || draft.travelChanged) {
        const amount = travelPreview(draft,appointment);
        if (draft.manual && amount === null) throw new Error("请填写有效的交通费金额，最多两位小数且不超过 RM99,999,999.99。");
        input.travel_fee_option_id = draft.optionId;
        input.travel_fee_label = draft.travelLabel;
        input.travel_fee_amount = amount;
    }
    if (!appointment || draft.note !== (appointment.travel_fee_note ?? "")) input.travel_fee_note = draft.note.trim() || null;
    return input;
}

export function completionInitialAmount(pet: AppointmentPet): string {
    const value = pet.amount ?? pet.quoted_amount ?? pet.default_price;
    return value == null ? "" : Number(value).toFixed(2);
}

export function safeHttpUrl(value: string | null | undefined): string | null {
    if (!value?.trim()) return null;
    try {
        const url = new URL(value.trim());
        return ["http:","https:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
    } catch { return null; }
}

export function mapHref(location: LocationSnapshot): string | null {
    const stored = safeHttpUrl(location.map_url);
    if (stored) return stored;
    const query = location.address_text?.trim() || (location.latitude != null && location.longitude != null
        ? `${location.latitude},${location.longitude}` : "");
    return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null;
}

export function appointmentLocation(appointment: Appointment): LocationSnapshot {
    return { label: appointment.address_label_snapshot, address_text: appointment.address_text_snapshot,
        map_url: appointment.map_url_snapshot, latitude: appointment.latitude_snapshot, longitude: appointment.longitude_snapshot };
}

export function validateAddressForm(label: string, text: string, map: string): string | null {
    if (!label.trim() || label.trim().length > 100) return "请填写标签，最多 100 个字。";
    if (!text.trim() && !map.trim()) return "请填写文字地址或地图链接。";
    if (text.trim().length > 4000 || map.trim().length > 2048) return "地址或地图链接过长，请缩短后重试。";
    if (map.trim() && !safeHttpUrl(map)) return "请填写有效的 HTTP/HTTPS 地图链接。";
    return null;
}

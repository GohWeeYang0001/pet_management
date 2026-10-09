import type { PoolClient } from "pg";
import { isMoney, isOptionalText, isText } from "../validation";
import { isBusinessId, type ServiceKind } from "./catalog";
import { BusinessError } from "./errors";
import { quotedPetAmount } from "./money";

export interface BookingPet {
    appointment_pet_id?: string | number | null;
    pet_id: string | number;
    service_id: string | number;
    remark?: string | null;
    addons?: Array<{ service_id: string | number }>;
}
interface ExistingPet { pet_id: string; service_id: string; addon_ids: string[] }
interface CatalogService {
    service_id: string; service_name: string; default_price: string | null;
    is_active: boolean; service_kind: ServiceKind;
}
interface PreparedPet extends BookingPet {
    base: CatalogService; addonServices: CatalogService[]; quote: string | null;
}
const own = (body: object, key: string) => Object.prototype.hasOwnProperty.call(body, key);

export function bookingPets(input: unknown, editing: boolean): BookingPet[] {
    if (!Array.isArray(input) || input.length === 0) throw new BusinessError(400, "At least one pet with a base service is required");
    for (const value of input) {
        if (!value || typeof value !== "object" || !isBusinessId(value.pet_id) || !isBusinessId(value.service_id)
            || !isOptionalText(value.remark)
            || (value.appointment_pet_id != null && (!editing || !isBusinessId(value.appointment_pet_id)))) {
            throw new BusinessError(400, "Valid pet, base service and appointment pet IDs are required");
        }
        if (value.addons !== undefined) {
            if (!Array.isArray(value.addons) || !value.addons.every((addon: unknown) =>
                !!addon && typeof addon === "object" && isBusinessId((addon as { service_id?: unknown }).service_id))) {
                throw new BusinessError(400, "Add-ons must be an array of service IDs");
            }
            const ids = value.addons.map((addon: { service_id: string | number }) => String(addon.service_id));
            if (new Set(ids).size !== ids.length) throw new BusinessError(400, "An add-on service may only be selected once per pet");
        }
    }
    const pets = input as BookingPet[];
    const ids = pets.flatMap(row => row.appointment_pet_id == null ? [] : [String(row.appointment_pet_id)]);
    if (new Set(ids).size !== ids.length) throw new BusinessError(400, "Appointment pet rows must be unique");
    return pets;
}

export async function existingBookingPets(client: PoolClient, appointmentId: string | number): Promise<Map<string, ExistingPet>> {
    const result = await client.query<{ appointment_pet_id: string; pet_id: string; service_id: string }>(
        "SELECT appointment_pet_id, pet_id, service_id FROM appointment_pet WHERE appointment_id = $1 ORDER BY appointment_pet_id FOR UPDATE",
        [appointmentId],
    );
    const current = new Map<string, ExistingPet>(result.rows.map(row =>
        [String(row.appointment_pet_id), { pet_id: String(row.pet_id), service_id: String(row.service_id), addon_ids: [] }]));
    const addons = await client.query<{ appointment_pet_id: string; service_id: string }>(
        `SELECT x.appointment_pet_id, x.service_id FROM appointment_pet_addon x
         JOIN appointment_pet ap USING (appointment_pet_id) WHERE ap.appointment_id = $1
         ORDER BY x.appointment_pet_addon_id`, [appointmentId],
    );
    for (const addon of addons.rows) current.get(String(addon.appointment_pet_id))!.addon_ids.push(String(addon.service_id));
    return current;
}

export async function prepareBookingPets(
    client: PoolClient, customerId: string | number, rows: BookingPet[],
    current = new Map<string, ExistingPet>(),
): Promise<PreparedPet[]> {
    if (rows.some(row => row.appointment_pet_id != null && !current.has(String(row.appointment_pet_id)))) {
        throw new BusinessError(400, "An appointment pet row does not belong to this appointment");
    }
    const selections = rows.map(row => ({
        row, previous: current.get(String(row.appointment_pet_id)),
        addonIds: row.addons?.map(addon => String(addon.service_id))
            ?? current.get(String(row.appointment_pet_id))?.addon_ids ?? [],
    }));
    const petIds = [...new Set(rows.map(row => String(row.pet_id)))];
    const petResult = await client.query<{ pet_id: string;is_archived:boolean }>(
        "SELECT pet_id,is_archived FROM pet WHERE customer_id = $1 AND pet_id = ANY($2::bigint[]) ORDER BY pet_id FOR SHARE",
        [customerId, petIds],
    );
    const pets = new Map(petResult.rows.map(row => [String(row.pet_id), row]));
    if (pets.size !== petIds.length) throw new BusinessError(400,"请选择该客户的有效宠物","BOOKING_VALIDATION",rows.flatMap((row,index)=>pets.has(String(row.pet_id))?[]:[{field:`pets.${index}.pet_id`,message:"宠物不属于该客户或已删除，请重新选择"}]));
    const serviceIds = [...new Set(selections.flatMap(s => [String(s.row.service_id), ...s.addonIds]))];
    // Lock all catalog rows in deterministic order before inserting any references.
    const serviceResult = await client.query<CatalogService>(
        `SELECT service_id, service_name, default_price, is_active, service_kind
         FROM service WHERE service_id = ANY($1::bigint[]) ORDER BY service_id FOR SHARE`, [serviceIds],
    );
    const services = new Map(serviceResult.rows.map(row => [String(row.service_id), row]));
    function eligible(id: string, kind: ServiceKind, retained: boolean,field:string): CatalogService {
        const service = services.get(id);
        if (!service || service.service_kind !== kind) throw new BusinessError(400,"服务不可用，请重新选择","BOOKING_VALIDATION",[{field,message:kind==="BASE"?"请选择有效基础服务":"请选择有效加购项目"}]);
        if (!retained && !service.is_active) {
            throw new BusinessError(400,"服务已停用，请重新选择","BOOKING_VALIDATION",[{field,message:kind==="BASE"?"基础服务已停用，请重新选择":"加购项目已停用，请重新选择"}]);
        }
        // Even a retained selection must have a valid price if a snapshot is known.
        if (service.default_price !== null) quotedPetAmount(service.default_price, []);
        return service;
    }
    return selections.map(({ row, previous, addonIds },index) => {
        const samePet = previous?.pet_id === String(row.pet_id);
        if(pets.get(String(row.pet_id))?.is_archived && !samePet) throw new BusinessError(409,"该宠物已归档，不能添加到新预约。","BOOKING_VALIDATION",[{field:`pets.${index}.pet_id`,message:"该宠物已归档，请重新选择"}]);
        const base = eligible(String(row.service_id), "BASE", !!samePet && previous?.service_id === String(row.service_id),`pets.${index}.service_id`);
        const addonServices = addonIds.map(id => {
            const addon = eligible(id, "ADDON", !!samePet && !!previous?.addon_ids.includes(id),`pets.${index}.addons`);
            if (addon.default_price === null) throw new BusinessError(400, "Add-ons require a configured default price");
            return addon;
        });
        return { ...row, base, addonServices,
            quote: quotedPetAmount(base.default_price, addonServices.map(addon => addon.default_price!)) };
    });
}

export async function saveBookingPets(client: PoolClient, appointmentId: string | number, rows: PreparedPet[], editing: boolean): Promise<void> {
    const kept: string[] = [];
    for (const row of rows) {
        let id: string;
        if (row.appointment_pet_id != null) {
            id = String(row.appointment_pet_id);
            await client.query(
                `UPDATE appointment_pet SET pet_id=$1, service_id=$2, remark=$3,
                 service_name_snapshot=$4, base_price_snapshot=$5, quoted_amount=$6
                 WHERE appointment_pet_id=$7 AND appointment_id=$8`,
                [row.pet_id, row.service_id, row.remark?.trim() || null, row.base.service_name,
                    row.base.default_price, row.quote, id, appointmentId],
            );
        } else {
            const inserted = await client.query<{ appointment_pet_id: string }>(
                `INSERT INTO appointment_pet (appointment_id,pet_id,service_id,remark,
                 service_name_snapshot,base_price_snapshot,quoted_amount)
                 VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING appointment_pet_id`,
                [appointmentId, row.pet_id, row.service_id, row.remark?.trim() || null,
                    row.base.service_name, row.base.default_price, row.quote],
            );
            id = inserted.rows[0].appointment_pet_id;
        }
        kept.push(id);
        await client.query("DELETE FROM appointment_pet_addon WHERE appointment_pet_id = $1", [id]);
        for (const addon of row.addonServices) {
            await client.query(
                `INSERT INTO appointment_pet_addon (appointment_pet_id,service_id,service_name_snapshot,price_snapshot)
                 VALUES ($1,$2,$3,$4)`, [id, addon.service_id, addon.service_name, addon.default_price],
            );
        }
    }
    if (editing) await client.query(
        "DELETE FROM appointment_pet WHERE appointment_id=$1 AND NOT (appointment_pet_id=ANY($2::bigint[]))",
        [appointmentId, kept],
    );
}

export const bookingExtraKeys = [
    "travel_fee_label", "travel_fee_amount", "travel_fee_note",
    "customer_address_id", "address_label_snapshot", "address_text_snapshot", "map_url_snapshot",
    "latitude_snapshot", "longitude_snapshot",
] as const;

export async function bookingExtras(
    client: PoolClient, customerId: string | number, body: Record<string, unknown>,
    current?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
    const extras: Record<string, unknown> = Object.fromEntries(bookingExtraKeys.map(key =>
        [key, current?.[key] ?? null]));
    if (own(body, "customer_address_id")) {
        const selected = body.customer_address_id;
        if (selected != null && !isBusinessId(selected)) throw new BusinessError(400, "Invalid customer address ID");
        const same = selected != null && String(selected) === String(current?.customer_address_id);
        if (selected == null) {
            for (const key of bookingExtraKeys.filter(key => !key.startsWith("travel_"))) extras[key] = null;
        } else {
            const result = await client.query(
                "SELECT * FROM customer_address WHERE address_id=$1 AND customer_id=$2 FOR SHARE", [selected, customerId],
            );
            if (!result.rowCount || (!same && !result.rows[0].is_active)) {
                throw new BusinessError(400, "请选择该客户的有效服务地址","BOOKING_VALIDATION",[{field:"address",message:"服务地址不可用，请重新选择"}]);
            }
            if (!same) {
                const address = result.rows[0];
                Object.assign(extras, { customer_address_id: address.address_id,
                    address_label_snapshot: address.label, address_text_snapshot: address.address_text,
                    map_url_snapshot: address.map_url, latitude_snapshot: address.latitude, longitude_snapshot: address.longitude });
            }
        }
    }
    if (own(body,"travel_fee_note")) {
        if (body.travel_fee_note != null && !isText(body.travel_fee_note,2000,false)) {
            throw new BusinessError(400,"Travel fee note must be at most 2000 characters");
        }
        extras.travel_fee_note = (body.travel_fee_note as string | null)?.trim() || null;
    }
    // The option ID validates an explicit selection, but is never persisted as a FK.
    // Untouched historical charges survive repricing/deactivation of catalog entries.
    const requiresChoice = !current || current.travel_fee_label == null || current.travel_fee_amount == null;
    const selecting = ["travel_fee_option_id","travel_fee_label","travel_fee_amount"].some(key=>own(body,key));
    if (requiresChoice || selecting) {
        if (!isBusinessId(body.travel_fee_option_id) || !isText(body.travel_fee_label,100) || !isMoney(body.travel_fee_amount)) {
            throw new BusinessError(400,"请选择有效上门交通费并填写金额","BOOKING_VALIDATION",[{field:"travel",message:"请选择有效上门交通费并填写金额"}]);
        }
        const option = (await client.query(
            "SELECT label,amount FROM travel_fee_option WHERE travel_fee_option_id=$1 AND is_active=TRUE FOR SHARE",
            [body.travel_fee_option_id],
        )).rows[0];
        if (!option || body.travel_fee_label.trim() !== option.label
            || (option.amount !== null && body.travel_fee_amount !== Number(option.amount))) {
            throw new BusinessError(400,"交通费选项已变化，请重新选择","BOOKING_VALIDATION",[{field:"travel",message:"交通费选项已变化，请重新选择"}]);
        }
        extras.travel_fee_label = option.label;
        extras.travel_fee_amount = body.travel_fee_amount;
    }
    return extras;
}

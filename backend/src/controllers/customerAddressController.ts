import { Request, Response } from "express";
import { pool } from "../db";
import { isText } from "../validation";
import { isBusinessId } from "../business/catalog";
import { BusinessError, businessFailure } from "../business/errors";

const fields = "address_id,customer_id,label,address_text,map_url,latitude,longitude,is_default,is_active,created_at,updated_at";
function response(row: Record<string, unknown>) {
    return {...row,latitude:row.latitude == null ? null : Number(row.latitude),longitude:row.longitude == null ? null : Number(row.longitude)};
}
const own = (body: object,key: string) => Object.prototype.hasOwnProperty.call(body,key);

function nullableLocationText(value: unknown, max: number, field: string): string | null {
    if (value == null) return null;
    if (!isText(value,max,false)) throw new BusinessError(400,field + " must be text with at most " + max + " characters");
    return value.trim() || null;
}

function validate(body: Record<string, unknown>) {
    if (!isText(body.label,100)
        || (body.is_default !== undefined && typeof body.is_default !== "boolean")
        || (body.is_active !== undefined && typeof body.is_active !== "boolean")) {
        throw new BusinessError(400,"A label and valid active/default settings are required");
    }
    if (own(body,"address_text")) nullableLocationText(body.address_text,4000,"Address text");
    const mapUrl = nullableLocationText(body.map_url,2048,"Map URL");
    if (mapUrl !== null) {
        try {
            const url = new URL(mapUrl);
            if (!["http:","https:"].includes(url.protocol) || url.username || url.password) throw new Error("Invalid URL");
        } catch { throw new BusinessError(400,"Map URL must use HTTP or HTTPS without credentials"); }
    }
    if (own(body,"latitude") || own(body,"longitude")) {
        const lat = body.latitude, lon = body.longitude;
        if (!(lat === null && lon === null) &&
            !(typeof lat === "number" && Number.isFinite(lat) && lat >= -90 && lat <= 90
              && typeof lon === "number" && Number.isFinite(lon) && lon >= -180 && lon <= 180)) {
            throw new BusinessError(400,"Supply both latitude and longitude within valid ranges, or clear both with null");
        }
    }
}

export async function getCustomerAddresses(req: Request,res: Response): Promise<void> {
    const customerId = req.params.customerId;
    if (!isBusinessId(customerId)) { res.status(400).json({message:"Invalid customer ID"}); return; }
    try {
        if (!(await pool.query("SELECT 1 FROM customer WHERE customer_id=$1",[customerId])).rowCount) throw new BusinessError(404,"Customer not found");
        const result = await pool.query("SELECT "+fields+" FROM customer_address WHERE customer_id=$1 ORDER BY is_active DESC,is_default DESC,address_id",[customerId]);
        res.json(result.rows.map(response));
    } catch (error) { businessFailure(res,error,"Error fetching customer addresses:"); }
}

async function saveAddress(req: Request,res: Response,editing: boolean): Promise<void> {
    const customerId = req.params.customerId, addressId = req.params.addressId, body = req.body ?? {};
    let client;
    try {
        if (!isBusinessId(customerId) || (editing && !isBusinessId(addressId))) throw new BusinessError(400,"Invalid customer/address ID");
        validate(body);
        client = await pool.connect();
        await client.query("BEGIN");
        // Serialize default changes per customer, including concurrent first-address creation.
        if (!(await client.query("SELECT 1 FROM customer WHERE customer_id=$1 FOR UPDATE",[customerId])).rowCount) throw new BusinessError(404,"Customer not found");
        let current: Record<string,unknown> | undefined;
        if (editing) {
            current = (await client.query("SELECT * FROM customer_address WHERE address_id=$1 AND customer_id=$2 FOR UPDATE",[addressId,customerId])).rows[0];
            if (!current) throw new BusinessError(404,"Address not found for this customer");
        }
        // Validate the resulting location, not just the fields included in this update.
        const addressText = nullableLocationText(own(body,"address_text") ? body.address_text : current?.address_text,4000,"Address text");
        const mapUrl = nullableLocationText(own(body,"map_url") ? body.map_url : current?.map_url,2048,"Map URL");
        const latitude = own(body,"latitude") ? body.latitude : current?.latitude ?? null;
        const longitude = own(body,"longitude") ? body.longitude : current?.longitude ?? null;
        if (addressText === null && mapUrl === null && !(latitude != null && longitude != null)) {
            throw new BusinessError(400,"Provide address text, a map URL, or paired coordinates");
        }
        const active = body.is_active ?? current?.is_active ?? true;
        let defaultAddress = active && (body.is_default ?? current?.is_default ?? false);
        const others = await client.query(
            "SELECT COUNT(*)::int AS active_count FROM customer_address WHERE customer_id=$1 AND is_active=TRUE AND ($2::bigint IS NULL OR address_id<>$2)",
            [customerId,editing ? addressId : null],
        );
        // First active address becomes default. No address is required for a customer.
        if (active && !current?.is_active && others.rows[0].active_count === 0) defaultAddress = true;
        if (defaultAddress) await client.query(
            "UPDATE customer_address SET is_default=FALSE,updated_at=CURRENT_TIMESTAMP WHERE customer_id=$1 AND is_default=TRUE AND ($2::bigint IS NULL OR address_id<>$2)",
            [customerId,editing ? addressId : null],
        );
        const values = [customerId,(body.label as string).trim(),addressText,mapUrl,
            latitude,longitude,defaultAddress,active];
        const result = editing
            ? await client.query("UPDATE customer_address SET label=$2,address_text=$3,map_url=$4,latitude=$5,longitude=$6,is_default=$7,is_active=$8,updated_at=CURRENT_TIMESTAMP WHERE customer_id=$1 AND address_id=$9 RETURNING "+fields,[...values,addressId])
            : await client.query("INSERT INTO customer_address(customer_id,label,address_text,map_url,latitude,longitude,is_default,is_active) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING "+fields,values);
        await client.query("COMMIT");
        res.status(editing ? 200 : 201).json(response(result.rows[0]));
    } catch (error) {
        if (client) await client.query("ROLLBACK");
        businessFailure(res,error,"Error saving customer address:");
    } finally { client?.release(); }
}
export async function createCustomerAddress(req: Request,res: Response): Promise<void> { await saveAddress(req,res,false); }
export async function updateCustomerAddress(req: Request,res: Response): Promise<void> { await saveAddress(req,res,true); }

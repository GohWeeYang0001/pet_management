// Canonical financial aggregation: exactly one row per appointment. Neither
// add-on snapshots nor future payment rows participate in pet charge arithmetic.
// NULL quotes on legacy rows mean unknown, not an invented zero/current price.
function chargesCte(petFilter = ""): string { return `
    WITH pet_charge_totals AS (
        SELECT appointment_id, COALESCE(SUM(amount), 0) AS final_pet_total,
               CASE WHEN COUNT(*) = COUNT(quoted_amount) THEN SUM(quoted_amount)
                    ELSE NULL END AS quoted_pet_total
        FROM appointment_pet ${petFilter} GROUP BY appointment_id
    ), appointment_charges AS (
        SELECT a.*,
               CASE WHEN a.status = 'COMPLETED' THEN COALESCE(p.final_pet_total, 0)
                    ELSE NULL END AS pet_charges,
               CASE WHEN a.status = 'CONFIRMED' THEN p.quoted_pet_total ELSE NULL END AS quoted_pet_total,
               CASE WHEN a.status = 'COMPLETED' THEN COALESCE(p.final_pet_total, 0) + COALESCE(a.travel_fee_amount, 0)
                    ELSE NULL END AS amount_due,
               CASE WHEN a.status = 'CONFIRMED' AND p.quoted_pet_total IS NOT NULL
                    THEN p.quoted_pet_total + COALESCE(a.travel_fee_amount, 0) ELSE NULL END AS quoted_total
        FROM appointment a LEFT JOIN pet_charge_totals p USING (appointment_id)
    )`; }
export const appointmentChargesCte = chargesCte();
export const customerChargesCte = chargesCte("WHERE appointment_id IN (SELECT appointment_id FROM appointment WHERE customer_id=$1)");

const appointmentDetailsSql = `
    SELECT a.appointment_id, TO_CHAR(a.appointment_date, 'YYYY-MM-DD') AS appointment_date,
           a.start_time, a.status, a.remark, c.customer_id, c.customer_name, c.customer_hp,c.is_archived AS customer_is_archived,
           a.travel_fee_label, a.travel_fee_amount,
           a.travel_fee_note, a.customer_address_id, a.address_label_snapshot,
           a.address_text_snapshot, a.map_url_snapshot, a.latitude_snapshot,
           a.longitude_snapshot, a.payment_tracking_started_at,
           a.pet_charges, a.quoted_pet_total, a.amount_due, a.quoted_total, detail.pets
    FROM appointment_charges a JOIN customer c ON c.customer_id = a.customer_id
    LEFT JOIN LATERAL (
        SELECT COALESCE(json_agg(json_build_object(
            'appointment_pet_id', ap.appointment_pet_id, 'pet_id', p.pet_id,
            'pet_name', p.pet_name, 'is_archived',p.is_archived, 'pet_type', p.pet_type, 'service_id', s.service_id,
            'service_name', COALESCE(ap.service_name_snapshot, s.service_name),
            'service_name_snapshot', ap.service_name_snapshot, 'default_price', s.default_price,
            'base_price_snapshot', ap.base_price_snapshot, 'quoted_amount', ap.quoted_amount,
            'amount', ap.amount, 'remark', ap.remark, 'addons', extra.addons
        ) ORDER BY ap.appointment_pet_id), '[]') AS pets
        FROM appointment_pet ap JOIN pet p ON p.pet_id = ap.pet_id
        LEFT JOIN service s ON s.service_id = ap.service_id
        LEFT JOIN LATERAL (
            SELECT COALESCE(json_agg(json_build_object(
                'appointment_pet_addon_id', x.appointment_pet_addon_id,
                'service_id', x.service_id, 'service_name_snapshot', x.service_name_snapshot,
                'price_snapshot', x.price_snapshot
            ) ORDER BY x.appointment_pet_addon_id), '[]') AS addons
            FROM appointment_pet_addon x WHERE x.appointment_pet_id = ap.appointment_pet_id
        ) extra ON TRUE
        WHERE ap.appointment_id = a.appointment_id
    ) detail ON TRUE`;

export const appointmentReadSql = appointmentChargesCte + appointmentDetailsSql;
// Only IDs from the bounded history page receive rich pet/addon/location details.
export const appointmentPageReadSql = chargesCte("WHERE appointment_id=ANY($1::bigint[])") + appointmentDetailsSql
    + " WHERE a.appointment_id=ANY($1::bigint[]) ORDER BY a.appointment_date DESC,a.start_time DESC,a.appointment_id DESC";

export function appointmentResponse(row: Record<string, unknown>): Record<string, unknown> {
    const result = { ...row };
    for (const key of ["travel_fee_amount", "pet_charges", "quoted_pet_total", "amount_due", "quoted_total", "latitude_snapshot", "longitude_snapshot"]) {
        if (result[key] != null) result[key] = Number(result[key]);
    }
    return result;
}

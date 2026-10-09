// All appointment statuses count as history. Also protect legacy cross-owner refs.
const customerHistory = `EXISTS(SELECT 1 FROM appointment a WHERE a.customer_id=c.customer_id)
    OR EXISTS(SELECT 1 FROM appointment_pet ap JOIN pet p ON p.pet_id=ap.pet_id WHERE p.customer_id=c.customer_id)
    OR EXISTS(SELECT 1 FROM appointment a JOIN customer_address ca ON ca.address_id=a.customer_address_id WHERE ca.customer_id=c.customer_id)`;
export const customerManagementColumns = `c.customer_id,c.customer_name,c.customer_hp,c.created_at,c.is_archived,
    (SELECT COUNT(*)::int FROM pet p WHERE p.customer_id=c.customer_id) AS pet_count,
    (SELECT COUNT(*)::int FROM customer_address ca WHERE ca.customer_id=c.customer_id) AS address_count,
    (${customerHistory}) AS has_appointment_history, NOT (${customerHistory}) AS can_delete`;
export const petManagementColumns = `p.pet_id,p.customer_id,p.pet_name,p.pet_type,p.pet_remark,p.is_archived,
    EXISTS(SELECT 1 FROM appointment_pet ap WHERE ap.pet_id=p.pet_id) AS has_appointment_history,
    NOT EXISTS(SELECT 1 FROM appointment_pet ap WHERE ap.pet_id=p.pet_id) AS can_delete`;

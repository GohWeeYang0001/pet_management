-- Existing appointments were recorded bookings; normalize legacy PENDING rows.
BEGIN;

UPDATE appointment
SET status = 'CONFIRMED', updated_at = CURRENT_TIMESTAMP
WHERE status = 'PENDING';

ALTER TABLE appointment DROP CONSTRAINT chk_appointment_status;
ALTER TABLE appointment ALTER COLUMN status SET DEFAULT 'CONFIRMED';
ALTER TABLE appointment ADD CONSTRAINT chk_appointment_status
    CHECK (status IN ('CONFIRMED', 'COMPLETED', 'CANCELLED'));

COMMIT;

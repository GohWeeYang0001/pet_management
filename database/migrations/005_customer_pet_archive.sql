-- Additive production-safe upgrade after Business V2. No historical rows removed.
BEGIN;
ALTER TABLE customer ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE pet ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
-- Support history checks without altering any deletion/cascade relationships.
CREATE INDEX IF NOT EXISTS idx_appointment_customer ON appointment(customer_id);
CREATE INDEX IF NOT EXISTS idx_appointment_pet_pet ON appointment_pet(pet_id);
CREATE INDEX IF NOT EXISTS idx_pet_customer ON pet(customer_id);
COMMIT;

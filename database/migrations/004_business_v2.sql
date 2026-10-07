-- UTF-8 source: initialize with psql --file (not a PowerShell text pipe).
SET client_encoding = 'UTF8';
-- Additive Business V2 upgrade from schema.sql (pre-V2) + migration 001.
-- Prerequisites: V1 expense/inventory, final status rules (002), auth tables (003).
-- Apply ONCE. Plain DDL fails on duplicate application instead of hiding drift.
BEGIN;

-- No UPDATE/backfill of old charges, quotes, addresses, payment history or addons.
ALTER TABLE service
    ADD COLUMN service_kind VARCHAR(10) NOT NULL DEFAULT 'BASE'
        CONSTRAINT chk_service_kind CHECK (service_kind IN ('BASE', 'ADDON'));

CREATE TABLE travel_fee_option (
    travel_fee_option_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    label VARCHAR(100) NOT NULL CHECK (LENGTH(BTRIM(label)) > 0),
    -- NULL is a manual-price template, not a distance rule.
    amount NUMERIC(10,2)
        CONSTRAINT chk_travel_fee_option_amount CHECK (amount >= 0 AND amount <= 99999999.99),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_travel_fee_option_active_sort
    ON travel_fee_option (sort_order, travel_fee_option_id) WHERE is_active = TRUE;

-- Configurable starting templates, not demo history or automatic distance pricing.
INSERT INTO travel_fee_option (label, amount, sort_order)
VALUES
    ('5公里以内', 2, 10),
    ('5–7公里', 5, 20),
    ('7–10公里', 10, 30),
    ('10–15公里', 20, 40),
    ('15公里以上', NULL, 50);

CREATE TABLE customer_address (
    address_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customer(customer_id) ON DELETE CASCADE,
    label VARCHAR(100) NOT NULL CHECK (LENGTH(BTRIM(label)) > 0),
    address_text TEXT,
    map_url TEXT,
    latitude NUMERIC(9,6),
    longitude NUMERIC(9,6),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_customer_address_coordinates CHECK (
        (latitude IS NULL AND longitude IS NULL)
        OR (latitude IS NOT NULL AND longitude IS NOT NULL
            AND latitude BETWEEN -90 AND 90
            AND longitude BETWEEN -180 AND 180)
    ),
    CONSTRAINT chk_customer_address_location CHECK (
        COALESCE(address_text ~ '[^[:space:]]', FALSE)
        OR COALESCE(map_url ~ '[^[:space:]]', FALSE)
        OR (latitude IS NOT NULL AND longitude IS NOT NULL)
    )
);
CREATE INDEX idx_customer_address_customer ON customer_address (customer_id);
CREATE UNIQUE INDEX idx_customer_address_active_default
    ON customer_address (customer_id) WHERE is_default = TRUE AND is_active = TRUE;

ALTER TABLE appointment
    ADD COLUMN travel_fee_label VARCHAR(100),
    ADD COLUMN travel_fee_amount NUMERIC(10,2)
        CONSTRAINT chk_appointment_travel_fee_amount
        CHECK (travel_fee_amount >= 0 AND travel_fee_amount <= 99999999.99),
    ADD COLUMN travel_fee_note TEXT,
    ADD COLUMN customer_address_id BIGINT REFERENCES customer_address(address_id),
    ADD COLUMN address_label_snapshot VARCHAR(100),
    ADD COLUMN address_text_snapshot TEXT,
    ADD COLUMN map_url_snapshot TEXT,
    ADD COLUMN latitude_snapshot NUMERIC(9,6),
    ADD COLUMN longitude_snapshot NUMERIC(9,6),
    -- NULL means legacy payment history is unknown, not UNPAID.
    ADD COLUMN payment_tracking_started_at TIMESTAMPTZ;
ALTER TABLE appointment ADD CONSTRAINT chk_appointment_travel_fee_selection CHECK (
        (travel_fee_label IS NULL AND travel_fee_amount IS NULL)
        OR (travel_fee_label IS NOT NULL AND LENGTH(BTRIM(travel_fee_label)) > 0 AND travel_fee_amount IS NOT NULL)
    );
ALTER TABLE appointment ADD CONSTRAINT chk_appointment_snapshot_coordinates
        CHECK (
            (latitude_snapshot IS NULL AND longitude_snapshot IS NULL)
            OR (latitude_snapshot IS NOT NULL AND longitude_snapshot IS NOT NULL
                AND latitude_snapshot BETWEEN -90 AND 90
                AND longitude_snapshot BETWEEN -180 AND 180)
        );

ALTER TABLE appointment_pet
    -- Legacy snapshots stay NULL; amount remains the final actual total pet charge.
    ADD COLUMN service_name_snapshot VARCHAR(100),
    ADD COLUMN base_price_snapshot NUMERIC(10,2)
        CONSTRAINT chk_appointment_pet_base_price_snapshot
        CHECK (base_price_snapshot >= 0 AND base_price_snapshot <= 99999999.99),
    ADD COLUMN quoted_amount NUMERIC(10,2)
        CONSTRAINT chk_appointment_pet_quoted_amount
        CHECK (quoted_amount >= 0 AND quoted_amount <= 99999999.99);

CREATE TABLE appointment_pet_addon (
    appointment_pet_addon_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    appointment_pet_id BIGINT NOT NULL
        REFERENCES appointment_pet(appointment_pet_id) ON DELETE CASCADE,
    service_id BIGINT NOT NULL REFERENCES service(service_id),
    service_name_snapshot VARCHAR(100) NOT NULL,
    price_snapshot NUMERIC(10,2) NOT NULL
        CHECK (price_snapshot >= 0 AND price_snapshot <= 99999999.99),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- This unique index also supports appointment_pet_id lookups.
    CONSTRAINT uq_appointment_pet_addon UNIQUE (appointment_pet_id, service_id)
);
-- BASE/ADDON eligibility is validated by the future backend, not this FK.

CREATE TABLE payment (
    payment_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    appointment_id BIGINT NOT NULL
        REFERENCES appointment(appointment_id) ON DELETE RESTRICT,
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0 AND amount <= 99999999.99),
    payment_method VARCHAR(20) NOT NULL
        CHECK (payment_method IN ('CASH', 'BANK_TRANSFER', 'EWALLET', 'OTHER')),
    paid_at TIMESTAMPTZ NOT NULL,
    note TEXT,
    created_by_user_id BIGINT REFERENCES app_user(user_id) ON DELETE SET NULL,
    request_key UUID NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_payment_appointment ON payment (appointment_id);
CREATE INDEX idx_payment_paid_at ON payment (paid_at);
-- No payment_status: derive later. COMPLETED eligibility is backend-enforced.

COMMIT;

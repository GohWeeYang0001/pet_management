-- UTF-8 source: initialize with psql --file (not a PowerShell text pipe).
SET client_encoding = 'UTF8';
-- Complete fresh-database schema, including Business V2 and configurable travel options.
-- Run once on an empty database; do not also apply historical migrations.

CREATE TABLE customer (
    customer_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_name VARCHAR(100) NOT NULL,
    customer_hp VARCHAR(20) NOT NULL,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE pet (
    pet_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id BIGINT NOT NULL,
    pet_name VARCHAR(100) NOT NULL,
    pet_type VARCHAR(50),
    pet_remark TEXT,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_pet_customer
        FOREIGN KEY (customer_id)
        REFERENCES customer(customer_id)
        ON DELETE CASCADE
);

CREATE TABLE service (
    service_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    service_name VARCHAR(100) NOT NULL,
    default_price NUMERIC(10,2),
    service_kind VARCHAR(10) NOT NULL DEFAULT 'BASE'
        CONSTRAINT chk_service_kind CHECK (service_kind IN ('BASE', 'ADDON')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE appointment (
    appointment_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id BIGINT NOT NULL,
    appointment_date DATE NOT NULL,
    start_time TIME NOT NULL,
    travel_fee_label VARCHAR(100),
    travel_fee_amount NUMERIC(10,2)
        CONSTRAINT chk_appointment_travel_fee_amount
        CHECK (travel_fee_amount >= 0 AND travel_fee_amount <= 99999999.99),
    travel_fee_note TEXT,
    customer_address_id BIGINT REFERENCES customer_address(address_id),
    address_label_snapshot VARCHAR(100),
    address_text_snapshot TEXT,
    map_url_snapshot TEXT,
    latitude_snapshot NUMERIC(9,6),
    longitude_snapshot NUMERIC(9,6),
    -- NULL means legacy payment history is unknown, not UNPAID.
    payment_tracking_started_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED',
    remark TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_appointment_travel_fee_selection CHECK (
        (travel_fee_label IS NULL AND travel_fee_amount IS NULL)
        OR (travel_fee_label IS NOT NULL AND LENGTH(BTRIM(travel_fee_label)) > 0 AND travel_fee_amount IS NOT NULL)
    ),

    CONSTRAINT chk_appointment_snapshot_coordinates
        CHECK (
            (latitude_snapshot IS NULL AND longitude_snapshot IS NULL)
            OR (latitude_snapshot IS NOT NULL AND longitude_snapshot IS NOT NULL
                AND latitude_snapshot BETWEEN -90 AND 90
                AND longitude_snapshot BETWEEN -180 AND 180)
        ),

    CONSTRAINT fk_appointment_customer
        FOREIGN KEY (customer_id)
        REFERENCES customer(customer_id),

    CONSTRAINT chk_appointment_status
        CHECK (
            status IN (
                'CONFIRMED',
                'COMPLETED',
                'CANCELLED'
            )
        )
);

CREATE TABLE appointment_pet (
    appointment_pet_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    appointment_id BIGINT NOT NULL,
    pet_id BIGINT NOT NULL,
    service_id BIGINT NOT NULL,
    amount NUMERIC(10,2),
    -- Legacy snapshots stay NULL; amount remains the final actual total pet charge.
    service_name_snapshot VARCHAR(100),
    base_price_snapshot NUMERIC(10,2)
        CONSTRAINT chk_appointment_pet_base_price_snapshot
        CHECK (base_price_snapshot >= 0 AND base_price_snapshot <= 99999999.99),
    quoted_amount NUMERIC(10,2)
        CONSTRAINT chk_appointment_pet_quoted_amount
        CHECK (quoted_amount >= 0 AND quoted_amount <= 99999999.99),
    remark TEXT,

    CONSTRAINT fk_appointment_pet_appointment
        FOREIGN KEY (appointment_id)
        REFERENCES appointment(appointment_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_appointment_pet_pet
        FOREIGN KEY (pet_id)
        REFERENCES pet(pet_id),

    CONSTRAINT fk_appointment_pet_service
        FOREIGN KEY (service_id)
        REFERENCES service(service_id)
);

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

CREATE TABLE expense (
    expense_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    expense_date DATE NOT NULL,
    category VARCHAR(50) NOT NULL,
    item_name VARCHAR(100) NOT NULL,
    amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
    remark TEXT,
    source VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_expense_date ON expense (expense_date);

CREATE TABLE inventory_item (
    inventory_item_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    item_name VARCHAR(100) NOT NULL,
    current_quantity NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (current_quantity >= 0),
    unit VARCHAR(30) NOT NULL DEFAULT 'unit',
    reorder_level NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inventory_transaction (
    inventory_transaction_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    inventory_item_id BIGINT NOT NULL REFERENCES inventory_item(inventory_item_id),
    transaction_type VARCHAR(20) NOT NULL
        CHECK (transaction_type IN ('STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT')),
    quantity NUMERIC(10,2) NOT NULL CHECK (quantity > 0),
    amount NUMERIC(10,2) CHECK (amount >= 0),
    expense_id BIGINT REFERENCES expense(expense_id) ON DELETE SET NULL,
    remark TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_inventory_transaction_item_created
    ON inventory_transaction (inventory_item_id, created_at DESC);

CREATE TABLE app_user (
    user_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'EMPLOYEE' CHECK (role IN ('ADMIN', 'EMPLOYEE')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_app_user_username_lower ON app_user (LOWER(username));

CREATE TABLE app_session (
    token_hash CHAR(64) PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_app_session_user ON app_session (user_id);
CREATE INDEX idx_app_session_expiry ON app_session (expires_at);

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

CREATE INDEX idx_appointment_customer ON appointment(customer_id);
CREATE INDEX idx_appointment_pet_pet ON appointment_pet(pet_id);
CREATE INDEX idx_pet_customer ON pet(customer_id);

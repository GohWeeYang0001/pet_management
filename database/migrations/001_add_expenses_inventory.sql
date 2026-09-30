-- Additive V1 business tables. Safe to run once against the existing database.
BEGIN;

CREATE TABLE IF NOT EXISTS expense (
    expense_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    expense_date DATE NOT NULL,
    category VARCHAR(50) NOT NULL,
    item_name VARCHAR(100) NOT NULL,
    amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
    remark TEXT,
    source VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_expense_date ON expense (expense_date);

CREATE TABLE IF NOT EXISTS inventory_item (
    inventory_item_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    item_name VARCHAR(100) NOT NULL,
    current_quantity NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (current_quantity >= 0),
    unit VARCHAR(30) NOT NULL DEFAULT 'unit',
    reorder_level NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_transaction (
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

CREATE INDEX IF NOT EXISTS idx_inventory_transaction_item_created
    ON inventory_transaction (inventory_item_id, created_at DESC);

COMMIT;

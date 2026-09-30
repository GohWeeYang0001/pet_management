-- Authentication only; existing business tables and records are untouched.
BEGIN;

CREATE TABLE app_user (
    user_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'EMPLOYEE'
        CHECK (role IN ('ADMIN', 'EMPLOYEE')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Usernames are case-insensitive, including the CLI and login lookup.
CREATE UNIQUE INDEX idx_app_user_username_lower ON app_user (LOWER(username));

-- Only an HMAC of the random browser credential is stored on the server.
CREATE TABLE app_session (
    token_hash CHAR(64) PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_app_session_user ON app_session (user_id);
CREATE INDEX idx_app_session_expiry ON app_session (expires_at);

COMMIT;

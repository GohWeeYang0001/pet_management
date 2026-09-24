INSERT INTO customer (customer_name, customer_hp)
VALUES ('Alice', '0123456789');

INSERT INTO pet (
    customer_id,
    pet_name,
    pet_type
)
VALUES (
    1,
    'Bobby',
    'Dog'
);

INSERT INTO service (service_name, default_price)
VALUES
    ('Full Grooming', 100.00),
    ('Basic Grooming', 70.00),
    ('Bath', 50.00);

INSERT INTO appointment (
    customer_id,
    appointment_date,
    start_time,
    status
)
VALUES (
    1,
    '2026-09-25',
    '14:00',
    'CONFIRMED'
);

INSERT INTO appointment_pet (
    appointment_id,
    pet_id,
    service_id
)
VALUES (
    1,
    1,
    1
);
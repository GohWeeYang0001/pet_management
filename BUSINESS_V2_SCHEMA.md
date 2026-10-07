# Business V2 schema — final unreleased model

Business V2 is not released. Initialize an empty database with `database/schema.sql`
only. Upgrade a pre-V2 database (including expense/inventory, status and auth tables)
once with `database/migrations/004_business_v2.sql`. Do not apply 004 after the
fresh schema. Migration 004 is corrected directly; there is no migration 005.
Historical migrations 001–003 are unchanged. An already-initialized disposable V2
test database using the earlier unreleased model must be recreated, not upgraded.

## Pets and services

`pet.pet_type` remains nullable VARCHAR(50), optional free-text **品种** (金毛、贵宾、
柯基、英短、混种). `pet_remark` remains separate. No data is rewritten and no required
species classification is introduced.

Services retain `service_kind` BASE/ADDON (default BASE), name, default price and
active state. There is no service applicability column. Every active BASE/ADDON
may be chosen for any owned pet; employees select the appropriate named service.
Existing inactive selections may be retained on their original appointment pet.

## Configurable travel catalog

`travel_fee_option` has:
- `travel_fee_option_id`: identity primary key
- `label`: nonblank VARCHAR(100)
- `amount`: nullable NUMERIC(10,2), nonnegative and <=99,999,999.99
- `is_active`: boolean, default true
- `sort_order`: nonnegative integer, default 0
- `created_at`, `updated_at`: timestamps

A NULL catalog amount marks a manual-price template. It is not a distance engine.
There are no distance bounds, rule codes, manual flags, or appointment foreign
keys to this catalog. Initial configurable labels/prices are exactly:

| Label | Amount |
|---|---:|
| 5公里以内 | 2.00 |
| 5–7公里 | 5.00 |
| 7–10公里 | 10.00 |
| 10–15公里 | 20.00 |
| 15公里以上 | NULL (manual) |

No RM15 or automatic free option is seeded. Management may create an explicit
免交通费/0 option.

## Appointment travel attributes

Appointments store `travel_fee_label` (nullable VARCHAR(100)),
`travel_fee_amount` (nullable NUMERIC(10,2), **no default**), and optional
`travel_fee_note`. Both label and amount must be NULL together, or a nonblank
label and valid nonnegative amount must both exist. Catalog changes cannot affect
these appointment attributes.

Historical/unrecorded travel = NULL/NULL. Explicit free selection = its label/0.00.
Only calculations use COALESCE to treat a NULL travel amount as zero.
Phase 3.2 requires an explicit active catalog selection for all new API bookings
(and legacy booking edits). A request-only option ID validates that selection but
is not stored. The schema/migration remain nullable and unchanged; no legacy rows
are invalidated or backfilled.

## Quotes, final charges, addresses and future payments

Pet base/addon names and prices are snapshots. `quoted_amount` includes base and
addons exactly once; legacy quotes/snapshots stay NULL. `appointment_pet.amount`
is the final actual **pet service** charge, never travel.

Confirmed quote = SUM(pet quotes) + COALESCE(travel,0); if any pet quote is unknown,
the quote total is unknown. Completed due = SUM(final pet service charges) +
COALESCE(travel,0). Addon snapshots are not added again.

Customer-address tables, free labels, active/default flags, map-only/text-only/
coordinates-only combinations, coordinate checks, one active default per customer,
and appointment location snapshots are unchanged. Same-reference appointment
edits preserve snapshots; a different active owned address refreshes them.

The payment table (including request-key uniqueness, method/amount checks,
restricted appointment deletion and nullable user reference) and
`payment_tracking_started_at` are preserved for Phase 4. No payment API/UI exists.
COMPLETED means service work finished, not payment received.

## UTF-8 initialization and verification

SQL files are UTF-8 and explicitly set client_encoding=UTF8 before seed statements.
Initialize PostgreSQL itself with UTF8 encoding. On Windows, use `psql --file`:
do **not** pipe `Get-Content` into psql, because shell encoding conversion can
corrupt Chinese before it reaches PostgreSQL. The UI uses returned labels without
replacement text.

Schema tests load files as UTF-8 strings and assert exact Unicode labels and UTF8
client/server encoding on both fresh and migration-004 paths. They also verify
schema equivalence, NULL/zero distinction, absence of service applicability and
appointment option FKs, all legacy columns/rows preserved, address combinations/
snapshot retention, addons, payment constraints/cascades and transaction rollback.

See BUSINESS_V2_PHASE_3_2.md for the current pass's validation and changed-file inventory.

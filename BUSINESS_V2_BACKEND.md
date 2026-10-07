# Business V2 backend contracts — Phase 3.2

All business endpoints retain the existing authenticated-session and request-header
boundary. Money is a finite JSON number, nonnegative, <=99,999,999.99 with at most
two decimals. IDs must be valid PostgreSQL bigint IDs. Errors use sanitized API
messages; no SQL errors are exposed. No production/deployment change is required.

## Pet breed / service catalog

`pet.pet_type` is optional free-text breed/type, displayed as 品种. Remarks are
separate. No species inference or data rewriting occurs.

GET /api/services returns active catalog entries; `include_inactive=true` includes
inactive entries. Optional `service_kind=BASE|ADDON` filters kind only.
Fields: service_id, service_name, default_price (nullable for legacy catalog rows),
is_active, service_kind. There is no service applicability field/filter.

POST /api/services takes service_name, default_price, optional service_kind (BASE
default), and creates an active entry. PUT /api/services/:id takes name/price/active
and optional kind. A referenced kind change returns 409. Booking SHARE locks and
catalog UPDATE locks serialize kind changes against newly created references.

Every active BASE/ADDON may be selected for any pet owned by the appointment
customer. Original inactive selections are retainable only on the same original
appointment_pet and pet. Kind eligibility, ownership, unique addons, and price
validation remain enforced.

## Booking / editing / completion

POST /api/appointments accepts customer_id, appointment_date, start_time, optional
remark, and pets with pet_id, one BASE service_id, optional remark and
addons:[{service_id}]. PATCH /api/appointments/:id accepts a full desired pet list
with optional appointment_pet_id. Missing rows are removed; omitted addons retain
old selections, [] removes them. Editing refreshes current catalog snapshots/quotes.

Booking writes service/addon snapshots and quoted_amount, **never final amount**.
NULL base prices/legacy quotes remain unknown. Completion PATCH /:id/complete takes
all appointment_pet IDs and final actual pet service amounts. These amounts already
include addons but exclude travel. Completion remains atomic, sets COMPLETED and
payment_tracking_started_at; it does not depend on recording a payment.

Read endpoints list/detail return pet snapshots, addon snapshots, quote, final
amount, breed and remark; appointment location snapshots, travel attributes,
quoted_total, pet_charges and amount_due. Legacy catalog-name fallback is display
only, not a reconstructed historical quote.

Canonical aggregation has one row per appointment:
- CONFIRMED quoted_total = sum of all known pet quotes + COALESCE(travel,0).
  Any unknown pet quote yields NULL.
- COMPLETED amount_due = SUM(final pet amounts) + COALESCE(travel,0).
- CANCELLED has neither total.
- Addon snapshots and future payments do not join into charge arithmetic.
Customer spending/history and monthly reports reuse this aggregation.

## Travel option catalog

GET /api/travel-fee-options returns active options sorted by sort_order/id;
`include_inactive=true` includes inactive ones for management.
POST /api/travel-fee-options and PUT /api/travel-fee-options/:id accept:
`{label, amount, is_active, sort_order}`. Label is nonblank <=100 chars; amount
is valid money or NULL (manual-price template); active is boolean (default true);
sort order is an integer 0–1,000,000 (default 0).
Responses include travel_fee_option_id, label, amount, is_active, sort_order and
timestamps. PUT updates updated_at; an absent target returns 404.

The initial five labels are 5公里以内/5–7公里/7–10公里/10–15公里/15公里以上, with
amounts 2/5/10/20/NULL. No distance calculations or fixed rule codes exist.
Management can change labels/prices, ordering, active state and manual behavior.

## Required appointment travel selection (Phase 3.2)

Every new booking requires an explicit active catalog choice. Request payload:
`travel_fee_option_id` (selection validation only), `travel_fee_label` (nonblank
<=100 chars), `travel_fee_amount` (valid nonnegative JSON money), and optional
`travel_fee_note` (<=2000 chars).

The backend SHARE-locks the active option, validates its current label and requires
its exact numeric preset price. NULL-priced/manual templates require the employee's
actual valid amount. Unknown/inactive IDs, missing choice, NULL label/amount,
stale label/price, and preset overrides return 400. Numeric zero works only through
an explicitly selected active configured option.

Only label/actual amount/note are stored. The option ID is not an appointment column
or FK; historical charges remain independent of catalog repricing/deactivation.
The database columns stay nullable so legacy rows remain valid and readable.
On edit, untouched recorded charges and note-only edits preserve history without
catalog revalidation. Changing travel, or saving a legacy booking with NULL travel,
requires an explicit current active choice. NULL clearing is not offered in V2 forms.

## Deferred customer history (Phase 3.2)

GET /api/customers/:id/overview returns contact, pets, completed_visits and
total_spending only. It does not execute the detailed appointment-history query
and has no appointment_history property. Summary arithmetic remains canonical.

GET /api/customers/:id/appointments?limit=10&offset=0 returns:
`{appointments, limit, offset, has_more, next_offset}`.
Default limit is 10, maximum 20; offset is an integer 0–2,147,483,647. Invalid
parameters return 400; an absent customer returns 404. An existing customer with
no history gets [] and has_more=false.

Ordering is date, start time and appointment ID descending. A lightweight ID
query reads limit+1 IDs for a sentinel. Only the first limit IDs receive rich
pet/service/addon/location/charge details and scoped canonical pet aggregation.
There is no unlimited detailed-history query or history COUNT query. All V2
snapshots, statuses and backend-calculated quote/final totals remain available.

## Customer addresses (unchanged)

GET/POST /api/customers/:id/addresses; PUT /api/customers/:id/addresses/:addressId.
GET includes active/inactive addresses, active/default first. Label is required free
text <=100 chars. Text <=4000 and HTTP(S) map URL <=2048 are individually nullable;
map links must have no embedded credentials and may use any provider. Coordinates
are nullable as a pair in valid ranges. At least text, link, or coordinates is
required. Whitespace-only text/link normalize to NULL.

PUT omitted location fields/flags retain existing values. First active address is
default; defaults serialize under a customer lock, with one active default enforced
by the database. Deactivation clears its default flag but does not pick a replacement.
The employee UI requires text or link and has no manual coordinate editor.

Appointment customer_address_id is optional. New/different selection must be active
and owned; it copies location snapshots. Same ID preserves snapshots even if edited
or inactive. Omitted reference preserves; explicit NULL clears all address snapshots.

## Validation

Backend typecheck/build/tools typecheck, authentication, workflow (including
businessV2Smoke), and deployment tests were run on a new isolated disposable cluster.
Fixtures use unique markers and clean dependents before their own customer/services/
options; no pre-existing catalog entries are deleted. No demo seed.sql is required.

Schema/migration and frontend/browser results are in BUSINESS_V2_PHASE_3_2.md.
No payment API/UI or balances/collections are implemented.

# Appointment validation and customer/pet management

Prepared on `feature/customer-pet-management` for review only. No deployment,
production database access/change, payment functionality, commit, push or merge.

## User-facing changes

Appointment Create/Save buttons validate all required fields together rather than
being silently disabled for a missing travel choice. One Chinese summary names
every missing item, including each selected pet's name (Bobby 的基础服务, etc).
Inline errors appear by customer/date/time/address/pet/base/addon/travel fields.
Correcting a field clears its own error; unrelated remarks do not dismiss stale
backend field errors. Optional addons, remarks and free-text breed stay optional.

Both New/Edit use the same validation helper/hook. After a failure, the form scrolls
to and focuses the first invalid section/label in an animation frame, with preventScroll
on focus. It never programmatically focuses a native date/time input or launches a
picker/keyboard. Native controls and 16px mobile fonts remain unchanged.

**Service address is now required at the booking API/form layer**, as requested by
the missing-address scenario. Historical NULL references remain valid/readable in
the database. Editing such a booking requires choosing an address; recorded address
snapshots still remain unchanged if the reference is retained. Travel rules,
BASE/ADDON choices, quote/final-charge arithmetic and completion remain otherwise
unchanged.

Customer details now offer edit and history-aware remove/archive/restore actions.
Pet rows offer edit/delete/archive/restore. 已归档 is a subtle record badge.
Management can include archived customers with 显示已归档客户. New booking lists
exclude archived records. Existing historical appointment/history reads still show
their customer/pet records; confirmed edits may retain original archived references.

Dangerous actions use a separate instance of the existing BottomSheet (never stacked
portals/new backdrops). Confirmation first fetches fresh backend management state.
A no-history customer deletion shows exact pet/address counts and 此操作无法恢复.
Referenced records instead explain archive/history preservation. Delete and archive
are visually and verbally distinct. No frontend-only history guesses are used.

## Schema and rollout

New migration: **database/migrations/005_customer_pet_archive.sql**.
Fresh schema includes the same final definitions.

The additive migration adds:
- customer.is_archived BOOLEAN NOT NULL DEFAULT FALSE
- pet.is_archived BOOLEAN NOT NULL DEFAULT FALSE
- supporting indexes on appointment.customer_id, appointment_pet.pet_id and pet.customer_id

It does not delete/update historical business values or alter any FK/cascade policy.
Existing rows default active. Rerunning it preserves existing true archive flags.
Historical migrations **001–004, including 004_business_v2.sql, are untouched**.

Before deploying manually:
1. Back up the existing database and review/test migration 005 on staging.
2. Schedule a maintenance window: ALTER/ordinary index creation can briefly block
   writes; allow adequate time for larger appointment tables.
3. Against an **existing Business V2 database**, apply migration 005 only, using
   the existing secure PostgreSQL connection and ON_ERROR_STOP. For example:
   `psql --set=ON_ERROR_STOP=1 --file=database/migrations/005_customer_pet_archive.sql`.
   Do not rerun 004 or drop/recreate production data.
4. Deploy the coordinated backend/frontend after the migration; older code can
   ignore the new false-default columns during the migration-first rollout.
5. Verify archive filters, historical reads, delete restrictions and booking/address
   validation on the real iPhone before release.

A fresh empty database uses database/schema.sql only. No real application database
was migrated or recreated during this task. Temporary QA cluster/database fixtures
were used for all database tests and cleaned up afterward.

## API additions/changes

| API | Behavior |
|---|---|
| GET customers | Active by default; include_archived=true for management |
| GET customer/:id and overview | Fresh backend archive/history/delete state and dependent counts |
| GET customer/:id/pets | Active pets by default; include_archived=true for management/retained edits |
| GET customer/:id/pets/:petId | Fresh owned pet management state |
| DELETE customer/:id | Transactional no-history deletion; optional expected dependent counts |
| DELETE customer/:id/pets/:petId | No-history owned pet deletion only |
| PATCH customer/:id/archive | {is_archived:true/false}; archive/restore |
| PATCH customer/:id/pets/:petId/archive | Owned pet archive/restore |
| Booking POST/PATCH | Aggregated safe field_errors and final archive/address validation |

All routes remain behind existing authentication/request-header protection.
No API records a payment. Customer/pet PUT editing remains, with the original
free-text pet_type/品种 and separate pet_remark.

## Deletion safety

Any appointment status counts, including CONFIRMED, COMPLETED and CANCELLED.
Customer checks also protect legacy references through owned pets/addresses, even
if an old record has inconsistent cross-owner relationships.

Booking SHARE-locks customers/pets; management locks parent then pet in matching
order. History is checked under those locks before a permanent delete. A racing
booking either commits first and blocks deletion, or deletion wins and booking
cannot reference a removed row. Foreign keys provide final protection, mapped to a
sanitized 409/HAS_HISTORY. No delete endpoint executes an appointment DELETE.

The UI count preview is refreshed just before confirmation. Backend expected-count
checks reject changed dependent counts, requiring another confirmation. Archive
never destroys history and does not cascade archive flags to other record types;
customer and pet restoration are intentionally separate.

## Validation results

- Frontend build and lint: **PASS**
- Frontend regression tests: **21 passed, no skips**
- Backend source/tools type-check and build: **PASS**
- Auth, Business V2/workflow, management safety and deployment smoke tests: **PASS**
- Fresh schema versus 004+005 upgrade: **PASS**, legacy values preserved
- Direct migration 005 on populated V2 data: **PASS**; customer/pet/appointment/
  addon/address/payment values preserved, defaults active, rerun retains archives
- Controlled deletion-versus-booking lock races: **PASS**
- Cross-owner legacy FK references and all-status history deletion blocks: **PASS**
- Git whitespace checks: **PASS**

API scenarios included typo editing, no-history customer deletion of 2 pets/1 address,
count mismatch reconfirmation, no-history pet deletion, customer/pet delete rejection
with history, archive/restore, new-booking archive rejection, retained confirmed
references, historical due/spending RM95, required-address errors, multi-pet BASE
field paths, manual travel/addons and unchanged canonical totals.

Browser-first computer-use QA used disposable in-memory mocks, never real records.
It confirmed dynamic summaries, automatic per-field clearing, first-invalid focus
on SECTION/LABEL rather than INPUT, actual confirmation counts, reversible archive/
restore, archived history loading, customer typo editing, and no console warnings.
375/390/430px checks had no horizontal overflow, 16px controls, and contained native
date/time inputs. Permanent deletion was verified in isolated API tests; browser
confirmation review was canceled without deleting any real records.

Preserved by before/after checks: Calendar, BottomSheet, global mobile CSS/viewport,
authentication, migration 004, quote/final-charge helpers and lazy history machinery.
No CSS zoom/transform or viewport restrictions were added.

Still worth real-iPhone checks: keyboard/picker behavior when tapping highlighted
fields, first-error scrolling with Safari chrome, safe areas, long names/error
messages, and delete/archive confirmation touch comfort.

## Changed files

39 files compared with the start of this task (ignored build outputs excluded):

```text
BUSINESS_V2_BACKEND.md
CUSTOMER_PET_MANAGEMENT.md
backend/src/business/appointmentBooking.ts
backend/src/business/appointmentQueries.ts
backend/src/business/bookingValidation.ts
backend/src/business/errors.ts
backend/src/business/recordManagement.ts
backend/src/controllers/appointmentController.ts
backend/src/controllers/customerController.ts
backend/src/controllers/petController.ts
backend/src/controllers/recordManagementController.ts
backend/src/routes/customerRoutes.ts
backend/src/routes/petRoutes.ts
backend/tests/businessV2Smoke.ts
backend/tests/customerPetManagementSmoke.ts
backend/tests/workflowSmoke.ts
database/migrations/005_customer_pet_archive.sql
database/schema.sql
database/tests/business_v2_schema_smoke.mjs
frontend/src/businessV2.css
frontend/src/components/appointments/AppointmentDetailSheet.tsx
frontend/src/components/appointments/AppointmentExtrasFields.tsx
frontend/src/components/appointments/AppointmentV2Details.tsx
frontend/src/components/appointments/BookingValidation.tsx
frontend/src/components/appointments/EditAppointmentSheet.tsx
frontend/src/components/appointments/PetServicesFields.tsx
frontend/src/components/appointments/useBookingValidation.ts
frontend/src/components/customers/RecordActionSheet.tsx
frontend/src/components/sheets/NewAppointmentSheet.tsx
frontend/src/pages/CustomersPage.tsx
frontend/src/services/api.ts
frontend/src/services/customerService.ts
frontend/src/services/petService.ts
frontend/src/types/appointment.ts
frontend/src/types/customer.ts
frontend/src/types/pet.ts
frontend/src/utils/bookingValidation.ts
frontend/tests/businessV2.test.mjs
frontend/tests/qaServer.mjs
```

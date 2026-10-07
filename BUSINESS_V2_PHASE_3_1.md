# Business V2 Phase 3.1 corrections

Completed on `feature/business-v2`. No commit, push, merge, deployment, production
access, payment API/UI or migration 005 was performed.

## Final domain decisions

1. **Service applicability removed:** no service.pet_type in fresh schema/004,
   catalog queries/validation/types, booking eligibility, frontend editor/filtering
   or fixtures. BASE/ADDON, active checks, ownership, kind locking and quote/addon
   snapshots remain. Every active service of the requested kind is available to
   any owned pet.
2. **Pet field:** pet.pet_type is optional free-text **品种**, not a species enum.
   金毛 stays 金毛; remarks remain separate. No existing pet values are rewritten.
3. **Travel catalog:** travel_fee_option has identity ID, nonblank label, nullable
   NUMERIC(10,2) amount, active flag, nonnegative sort order and created/updated
   timestamps. NULL catalog amount is the only manual-template marker. No distance
   engine, codes, manual flags or appointment relation.
4. **Appointment columns:** nullable travel_fee_label and travel_fee_amount, plus
   existing optional travel_fee_note. A constraint requires either NULL/NULL or a
   nonblank label and nonnegative amount. There is no catalog FK or automatic
   amount default.
5. **NULL versus zero:** unselected = NULL/NULL; explicitly selected 免交通费/0 =
   that label/0.00. UI displays 未选择 versus RM0.00. Totals alone coalesce NULL to
   zero. Addons are already in each pet quote/final service charge and are never
   added a second time.
6. **15km+ custom:** the catalog's 15公里以上 amount is NULL; selecting it requires
   the employee's valid actual amount. It is stored directly with that label.
   Management can also create/change other manual templates.
7. **UTF-8:** schema/004 are UTF-8 and set client encoding explicitly. Initialize
   with psql --file (not Get-Content piping). Both fresh and upgraded databases
   were asserted to hold exactly 5公里以内 / 5–7公里 / 7–10公里 / 10–15公里 /
   15公里以上, with 2/5/10/20/NULL. No frontend replacement labels hide DB issues.
8. **Management:** 更多 → 上门交通费管理 is separate from per-pet service management.
   Authenticated GET/POST/PUT support list, label/price edits, manual toggle,
   active/inactive and order. Selectable amounts are fetched, not hard-coded.
9. **Completion:** editable 宠物最终服务费 stays separate from travel and a live
   最终应收总额. Browser verified RM90+RM5=RM95, then RM85+RM5=RM90. Completion
   means service finished, not payment received.
10. **History/detail:** confirmed wording is 预计服务费 / 预约预计总额; completed
    wording is 宠物最终服务费 / 最终应收. Backend totals/spending remain authoritative.
    Legacy unknown quotes/base snapshots still show 未记录. Legacy completed
    charges remain final pet service amounts.

Catalog price changes do not alter old bookings. Backend tests changed an owned
QA option from RM3 to RM9: the existing appointment stayed RM3; a new booking
copied RM9. Note-only edits preserved historical travel charges and address
snapshots.

## Validation

Final successful checks:

| Check | Result |
|---|---|
| Frontend npm run build | PASS |
| Frontend npm run lint | PASS |
| Frontend npm run test:business-v2 | 14 passed, no skips |
| Backend npm run typecheck | PASS |
| Backend npm run typecheck:tools | PASS |
| Backend npm run build | PASS |
| Backend npm run test:auth | PASS |
| Backend npm run test:workflow (includes Business V2 smoke) | PASS |
| Backend npm run test:deployment | PASS |
| Fresh schema + migration-004 upgrade tests | PASS |
| Git whitespace check | PASS |

Schema tests verified 14-table fresh/upgrade equivalence, all original legacy
columns/rows/values preserved, exact Unicode seed values, nullable travel/no
service-applicability or appointment-option FK, constraints, address combinations
and map-only snapshots, addon snapshots, payment preservation and rollback.

Backend tests covered 金毛 with every active BASE and ADDON, kind/active/ownership
checks and safe retention, configurable options, manual charges, NULL/explicit
zero, old/new catalog pricing, RM90+RM5=RM95, multiple pets, unknown quotes,
completion without payment, backend history/report totals and QA-only cleanup.

Browser-first QA (computer-use skill) used disposable mock fixtures, not business
records. It covered the management entry/editor, explicit RM0 creation, price
editing and manual deactivation/reactivation, all services for 金毛, unselected
travel, manual-entry totals, final-total updates and completed customer history.
At 375/390/430px, document width equaled viewport width; tested management,
booking/manual, completion and history screens had no horizontal overflow and
all form controls measured 16px. Native date/time controls stayed contained.
The backdrop remained transparent.

## Preserved / operational notes

Before/after hashes confirmed unchanged authentication code, migrations 001–003,
address API/forms, global CSS, viewport markup, BottomSheet and calendar code.
Payment schema/tracking remain for Phase 4. No payment states, balances or
collections were added. The AWS document edit only corrects a table-name reference;
no deployment/infrastructure configuration changed.

Testing used newly created disposable UTF-8 clusters, dedicated port 55439 and
a dedicated API-test database/port. The existing local `pet_management_v2_test`
database was **not accessed or recreated**. Recreate it from the final schema
before running this corrected unreleased app against it. Do not apply 004 to a
database that already contains the earlier unreleased V2 structures.

Only owned QA fixtures were removed by tests. Temporary test servers/clusters are
cleaned up after validation. No ignored environment secrets were edited.

Real-iPhone verification remains necessary for native date/time pickers, focus at
Safari 100%, safe areas with browser chrome/home indicator, touch comfort and long
sheet scrolling. Browser viewport checks do not emulate real iOS safe-area insets.

## Files changed in this pass

37 files (baseline comparison excludes earlier uncommitted work and ignored build outputs):

```text
AWS_DEPLOYMENT.md
BUSINESS_V2_BACKEND.md
BUSINESS_V2_FRONTEND.md
BUSINESS_V2_PHASE_3_1.md
BUSINESS_V2_SCHEMA.md
backend/src/business/appointmentBooking.ts
backend/src/business/appointmentQueries.ts
backend/src/business/catalog.ts
backend/src/controllers/serviceController.ts
backend/src/controllers/travelFeeController.ts
backend/src/routes/travelFeeRoutes.ts
backend/src/server.ts
backend/tests/businessV2Smoke.ts
database/migrations/004_business_v2.sql
database/schema.sql
database/tests/business_v2_schema_smoke.mjs
frontend/src/components/appointments/AppointmentExtrasFields.tsx
frontend/src/components/appointments/AppointmentV2Details.tsx
frontend/src/components/appointments/BookingEstimate.tsx
frontend/src/components/appointments/CompleteAppointmentForm.tsx
frontend/src/components/appointments/EditAppointmentSheet.tsx
frontend/src/components/appointments/PetServicesFields.tsx
frontend/src/components/sheets/NewAppointmentSheet.tsx
frontend/src/components/sheets/PetFormSheet.tsx
frontend/src/pages/AppointmentsPage.tsx
frontend/src/pages/CustomersPage.tsx
frontend/src/pages/MorePage.tsx
frontend/src/pages/ServicesPage.tsx
frontend/src/pages/TravelFeesPage.tsx
frontend/src/services/travelFeeService.ts
frontend/src/types/appointment.ts
frontend/src/types/service.ts
frontend/src/types/travelFee.ts
frontend/src/utils/businessV2.ts
frontend/src/utils/displayLabels.ts
frontend/tests/businessV2.test.mjs
frontend/tests/qaServer.mjs
```
